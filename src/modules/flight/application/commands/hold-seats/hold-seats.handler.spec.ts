import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HoldSeatsHandler } from './hold-seats.handler';
import { HoldSeatsCommand } from './hold-seats.command';
import { FlightRepositoryPort } from '../../../domain/repositories/flight.repository.interface';
import { Flight } from '../../../domain/models/flight.aggregate';
import { Seat } from '../../../domain/models/seat.entity';
import { FlightId } from '../../../domain/value-objects/flight-id.vo';
import { FlightNumber } from '../../../domain/value-objects/flight-number.vo';
import { Route } from '../../../domain/value-objects/route.vo';
import { Schedule } from '../../../domain/value-objects/schedule.vo';
import { Capacity } from '../../../domain/value-objects/capacity.vo';
import { SeatNumber } from '../../../domain/value-objects/seat-number.vo';
import { SeatsHeld } from '../../../domain/events/seats-held.event';
import { FlightNotFoundException } from '../../../domain/exceptions/flight-not-found.exception';
import { SeatNotAvailableException } from '../../../domain/exceptions/seat-not-available.exception';
import { DEFAULT_HOLD_DURATION_MINUTES } from '../../../domain/policies/seat-hold.policy';
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

describe('HoldSeatsHandler', () => {
  let flightRepository: InMemoryFlightRepository;
  let eventEmitter: { emit: jest.Mock };
  let handler: HoldSeatsHandler;

  beforeEach(() => {
    flightRepository = new InMemoryFlightRepository();
    eventEmitter = { emit: jest.fn() };
    handler = new HoldSeatsHandler(
      flightRepository,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('holds the requested seats, persists the flight, resolves expiresAt via the domain policy, and dispatches SeatsHeld', async () => {
    flightRepository.seed(buildFlight());
    const command = new HoldSeatsCommand({
      flightId: 'flight-1',
      seatNumbers: ['1A'],
      holdId: 'hold-1',
    });

    const beforeCall = Date.now();
    const result = await handler.execute(command);
    const afterCall = Date.now();

    // The handler doesn't receive expiresAt from the caller — it captures
    // "now" and lets the domain (SeatHoldPolicy, via Flight.holdSeats)
    // decide how long the hold lasts, so we assert against that window
    // rather than an exact caller-supplied value.
    const expectedDurationMs = DEFAULT_HOLD_DURATION_MINUTES * 60 * 1000;
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
      beforeCall + expectedDurationMs,
    );
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
      afterCall + expectedDurationMs,
    );

    expect(flightRepository.save).toHaveBeenCalledTimes(1);
    const savedFlight = flightRepository.save.mock.calls[0][0];
    expect(savedFlight.getAvailableSeatCount()).toBe(1);

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    const [eventName, event] = eventEmitter.emit.mock.calls[0] as [
      string,
      SeatsHeld,
    ];
    expect(eventName).toBe('SeatsHeld');
    expect(event).toBeInstanceOf(SeatsHeld);
    expect(event).toMatchObject({
      flightId: 'flight-1',
      holdId: 'hold-1',
      seatNumbers: ['1A'],
      expiresAt: result.expiresAt,
    });
  });

  it('throws FlightNotFoundException and does not persist or dispatch when the flight does not exist', async () => {
    const command = new HoldSeatsCommand({
      flightId: 'missing-flight',
      seatNumbers: ['1A'],
      holdId: 'hold-1',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      FlightNotFoundException,
    );
    expect(flightRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates domain invariant violations without persisting or dispatching', async () => {
    const flight = buildFlight();
    flight.holdSeats([SeatNumber.create('1A')], 'existing-hold', new Date());
    flight.pullDomainEvents();
    flightRepository.seed(flight);

    const command = new HoldSeatsCommand({
      flightId: 'flight-1',
      seatNumbers: ['1A'],
      holdId: 'hold-2',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      SeatNotAvailableException,
    );
    expect(flightRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
