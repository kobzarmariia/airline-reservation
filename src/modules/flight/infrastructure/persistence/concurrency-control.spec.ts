import { it, describe, expect, jest } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HoldSeatsHandler } from '../../application/commands/hold-seats/hold-seats.handler';
import { HoldSeatsCommand } from '../../application/commands/hold-seats/hold-seats.command';
import { FlightRepositoryPort } from '../../domain/repositories/flight.repository.interface';
import { Flight } from '../../domain/models/flight.aggregate';
import { Seat } from '../../domain/models/seat.entity';
import { FlightId } from '../../domain/value-objects/flight-id.vo';
import { FlightNumber } from '../../domain/value-objects/flight-number.vo';
import { Route } from '../../domain/value-objects/route.vo';
import { Schedule } from '../../domain/value-objects/schedule.vo';
import { Capacity } from '../../domain/value-objects/capacity.vo';
import { SeatNumber } from '../../domain/value-objects/seat-number.vo';
import { ConcurrencyConflictException } from '../../domain/exceptions/concurrency-conflict.exception';

// Stands in for PrismaFlightRepository: findById hands each caller an
// independent snapshot (mirroring a real DB round-trip, where two concurrent
// readers never share object identity), and save() only applies when the
// document's stored version still matches the version the caller read —
// exactly the findUnique + updateMany(version filter) flow the real
// repository uses against MongoDB.
class SimulatedFlightRepository implements FlightRepositoryPort {
  private documents = new Map<string, { flight: Flight; version: number }>();

  seed(flight: Flight): void {
    this.documents.set(flight.getId().value, {
      flight,
      version: flight.getVersion(),
    });
  }

  findById(id: FlightId): Promise<Flight | null> {
    const doc = this.documents.get(id.value);
    return Promise.resolve(doc ? cloneFlight(doc.flight, doc.version) : null);
  }

  save(flight: Flight): Promise<void> {
    const doc = this.documents.get(flight.getId().value);
    if (!doc || doc.version !== flight.getVersion()) {
      throw new ConcurrencyConflictException(flight.getId().value);
    }
    flight.incrementVersion();
    this.documents.set(flight.getId().value, {
      flight,
      version: flight.getVersion(),
    });
    return Promise.resolve();
  }

  findByFlightNumberAndDate(): Promise<Flight | null> {
    return Promise.resolve(null);
  }

  findFlightsWithExpiredHolds(): Promise<Flight[]> {
    return Promise.resolve([]);
  }
}

function cloneFlight(flight: Flight, version: number): Flight {
  return Flight.reconstitute(
    flight.getId(),
    flight.getFlightNumber(),
    flight.getRoute(),
    flight.getSchedule(),
    flight.getCapacity(),
    flight.getSeats().map((seat) =>
      Seat.reconstitute(
        seat.seatNumber,
        seat.seatClass,
        seat.price,
        seat.getStatus(),
        seat.getHoldId(),
        seat.getHoldExpiry(),
      ),
    ),
    version,
  );
}

function buildFlight(): Flight {
  const seats = [
    Seat.create(SeatNumber.create('1A'), 'ECONOMY'),
    Seat.create(SeatNumber.create('1B'), 'ECONOMY'),
  ];
  return Flight.create(
    FlightId.create('flight-1'),
    FlightNumber.create('LH1234'),
    Route.create('FRA', 'JFK'),
    Schedule.create(
      new Date(Date.now() + 60 * 60 * 1000),
      new Date(Date.now() + 9 * 60 * 60 * 1000),
    ),
    Capacity.create({ ECONOMY: 2, BUSINESS: 0, FIRST: 0 }),
    seats,
  );
}

describe('Optimistic concurrency control', () => {
  it('lets the first of two concurrent HoldSeatsCommands persist, and rejects the second — which read the same version — with ConcurrencyConflictException', async () => {
    const repository = new SimulatedFlightRepository();
    repository.seed(buildFlight());
    const eventEmitter = { emit: jest.fn() } as unknown as EventEmitter2;
    const handler = new HoldSeatsHandler(repository, eventEmitter);

    // Two requests race to hold different seats on the same flight. Each
    // holds a seat the other doesn't touch, so the domain invariants alone
    // would let both through — only the stale version read by the loser
    // should stop it.
    const commandA = new HoldSeatsCommand({
      flightId: 'flight-1',
      seatNumbers: ['1A'],
      holdId: 'hold-a',
    });
    const commandB = new HoldSeatsCommand({
      flightId: 'flight-1',
      seatNumbers: ['1B'],
      holdId: 'hold-b',
    });

    const [resultA, resultB] = await Promise.allSettled([
      handler.execute(commandA),
      handler.execute(commandB),
    ]);

    expect(resultA.status).toBe('fulfilled');
    expect(resultB.status).toBe('rejected');
    if (resultB.status === 'rejected') {
      expect(resultB.reason).toBeInstanceOf(ConcurrencyConflictException);
    }

    // The winning write landed, and the document only advanced one version
    // — the loser's write never got applied.
    const persisted = await repository.findById(FlightId.create('flight-1'));
    expect(persisted!.getVersion()).toBe(1);
    const seatA = persisted!
      .getSeats()
      .find((s) => s.seatNumber.value === '1A')!;
    const seatB = persisted!
      .getSeats()
      .find((s) => s.seatNumber.value === '1B')!;
    expect(seatA.isHeldBy('hold-a')).toBe(true);
    expect(seatB.isAvailable()).toBe(true);
  });
});
