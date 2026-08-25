import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReleaseSeatsHandler } from './release-seats.handler';
import { ReleaseSeatsCommand } from './release-seats.command';
import { FlightRepositoryPort } from '../../../domain/repositories/flight.repository.interface';
import { Flight } from '../../../domain/models/flight.aggregate';
import { Seat } from '../../../domain/models/seat.entity';
import { FlightId } from '../../../domain/value-objects/flight-id.vo';
import { FlightNumber } from '../../../domain/value-objects/flight-number.vo';
import { Route } from '../../../domain/value-objects/route.vo';
import { Schedule } from '../../../domain/value-objects/schedule.vo';
import { Capacity } from '../../../domain/value-objects/capacity.vo';
import { SeatNumber } from '../../../domain/value-objects/seat-number.vo';
import { SeatStatus } from '../../../domain/value-objects/seat-status.vo';
import { SeatsReleased } from '../../../domain/events/seats-released.event';
import { FlightNotFoundException } from '../../../domain/exceptions/flight-not-found.exception';
import { ConcurrencyConflictException } from '../../../domain/exceptions/concurrency-conflict.exception';

class InMemoryFlightRepository implements FlightRepositoryPort {
  private readonly flightsById = new Map<string, Flight>();
  private readonly persistedVersionsById = new Map<string, number>();
  readonly save = jest.fn((flight: Flight): Promise<void> => {
    const persistedVersion = this.persistedVersionsById.get(
      flight.getId().value,
    );
    if (
      persistedVersion !== undefined &&
      persistedVersion !== flight.getVersion()
    ) {
      throw new ConcurrencyConflictException(flight.getId().value);
    }
    flight.incrementVersion();
    this.persistedVersionsById.set(flight.getId().value, flight.getVersion());
    this.flightsById.set(flight.getId().value, flight);
    return Promise.resolve();
  });

  seed(flight: Flight): void {
    this.flightsById.set(flight.getId().value, flight);
    this.persistedVersionsById.set(flight.getId().value, flight.getVersion());
  }

  findById(id: FlightId): Promise<Flight | null> {
    return Promise.resolve(this.flightsById.get(id.value) ?? null);
  }

  findByFlightNumberAndDate(): Promise<Flight | null> {
    return Promise.resolve(null);
  }

  findFlightsWithExpiredHolds(): Promise<Flight[]> {
    return Promise.resolve([]);
  }
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

describe('ReleaseSeatsHandler', () => {
  let flightRepository: InMemoryFlightRepository;
  let eventEmitter: { emit: jest.Mock };
  let handler: ReleaseSeatsHandler;

  beforeEach(() => {
    flightRepository = new InMemoryFlightRepository();
    eventEmitter = { emit: jest.fn() };
    handler = new ReleaseSeatsHandler(
      flightRepository,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('releases a held seat, persists the flight, and dispatches SeatsReleased', async () => {
    const flight = buildFlight();
    flight.holdSeats([SeatNumber.create('1A')], 'hold-1', new Date());
    flight.pullDomainEvents();
    flightRepository.seed(flight);

    const command = new ReleaseSeatsCommand({
      flightId: 'flight-1',
      holdId: 'hold-1',
    });

    await handler.execute(command);

    expect(flightRepository.save).toHaveBeenCalledTimes(1);
    const savedFlight = flightRepository.save.mock.calls[0][0];
    const seat = savedFlight
      .getSeats()
      .find((s) => s.seatNumber.value === '1A')!;
    expect(seat.getStatus()).toBe(SeatStatus.AVAILABLE);

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    const [eventName, event] = eventEmitter.emit.mock.calls[0] as [
      string,
      SeatsReleased,
    ];
    expect(eventName).toBe('SeatsReleased');
    expect(event).toBeInstanceOf(SeatsReleased);
    expect(event).toMatchObject({
      flightId: 'flight-1',
      holdId: 'hold-1',
      seatNumbers: ['1A'],
    });
  });

  it('is idempotent: succeeds and dispatches no event when the hold no longer exists', async () => {
    flightRepository.seed(buildFlight());

    const command = new ReleaseSeatsCommand({
      flightId: 'flight-1',
      holdId: 'unknown-hold',
    });

    await expect(handler.execute(command)).resolves.toBeUndefined();
    expect(flightRepository.save).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('throws FlightNotFoundException and does not persist or dispatch when the flight does not exist', async () => {
    const command = new ReleaseSeatsCommand({
      flightId: 'missing-flight',
      holdId: 'hold-1',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      FlightNotFoundException,
    );
    expect(flightRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
