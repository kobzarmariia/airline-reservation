import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfirmSeatsHandler } from './confirm-seats.handler';
import { ConfirmSeatsCommand } from './confirm-seats.command';
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
import { SeatsConfirmed } from '../../../domain/events/seats-confirmed.event';
import { FlightNotFoundException } from '../../../domain/exceptions/flight-not-found.exception';
import { HoldNotFoundException } from '../../../domain/exceptions/hold-not-found.exception';

class InMemoryFlightRepository implements FlightRepositoryPort {
  private readonly flightsById = new Map<string, Flight>();
  readonly save = jest.fn((flight: Flight): Promise<void> => {
    this.flightsById.set(flight.getId().value, flight);
    return Promise.resolve();
  });

  seed(flight: Flight): void {
    this.flightsById.set(flight.getId().value, flight);
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

describe('ConfirmSeatsHandler', () => {
  let flightRepository: InMemoryFlightRepository;
  let eventEmitter: { emit: jest.Mock };
  let handler: ConfirmSeatsHandler;

  beforeEach(() => {
    flightRepository = new InMemoryFlightRepository();
    eventEmitter = { emit: jest.fn() };
    handler = new ConfirmSeatsHandler(
      flightRepository,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('confirms a held seat, persists the flight, and dispatches SeatsConfirmed', async () => {
    const flight = buildFlight();
    flight.holdSeats([SeatNumber.create('1A')], 'hold-1', new Date());
    flight.pullDomainEvents();
    flightRepository.seed(flight);

    const command = new ConfirmSeatsCommand({
      flightId: 'flight-1',
      holdId: 'hold-1',
    });

    const result = await handler.execute(command);

    expect(result.seatNumbers).toEqual(['1A']);
    expect(flightRepository.save).toHaveBeenCalledTimes(1);
    const savedFlight = flightRepository.save.mock.calls[0][0];
    const seat = savedFlight
      .getSeats()
      .find((s) => s.seatNumber.value === '1A')!;
    expect(seat.getStatus()).toBe(SeatStatus.OCCUPIED);

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    const [eventName, event] = eventEmitter.emit.mock.calls[0] as [
      string,
      SeatsConfirmed,
    ];
    expect(eventName).toBe('SeatsConfirmed');
    expect(event).toBeInstanceOf(SeatsConfirmed);
    expect(event).toMatchObject({
      flightId: 'flight-1',
      holdId: 'hold-1',
      seatNumbers: ['1A'],
    });
  });

  it('throws FlightNotFoundException and does not persist or dispatch when the flight does not exist', async () => {
    const command = new ConfirmSeatsCommand({
      flightId: 'missing-flight',
      holdId: 'hold-1',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      FlightNotFoundException,
    );
    expect(flightRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates domain invariant violations without persisting or dispatching', async () => {
    flightRepository.seed(buildFlight());

    const command = new ConfirmSeatsCommand({
      flightId: 'flight-1',
      holdId: 'unknown-hold',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      HoldNotFoundException,
    );
    expect(flightRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
