import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { CommandBus } from '@nestjs/cqrs';
import { ExpireSeatHoldsWorker } from './expire-seat-holds.worker';
import { ReleaseSeatsCommand } from '../../application/commands/release-seats/release-seats.command';
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

  readonly findFlightsWithExpiredHolds = jest.fn(
    (now: Date): Promise<Flight[]> => {
      const expired = Array.from(this.flightsById.values()).filter(
        (flight) => flight.getExpiredHoldIds(now).length > 0,
      );
      return Promise.resolve(expired);
    },
  );

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
}

function buildFlight(id: string): Flight {
  const seats = [
    Seat.create(SeatNumber.create('1A'), 'ECONOMY'),
    Seat.create(SeatNumber.create('1B'), 'ECONOMY'),
  ];
  return Flight.create(
    FlightId.create(id),
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

describe('ExpireSeatHoldsWorker', () => {
  let flightRepository: InMemoryFlightRepository;
  let commandBus: { execute: jest.Mock };
  let worker: ExpireSeatHoldsWorker;

  // holdSeats(..., requestedAt) resolves expiresAt as requestedAt + the
  // policy's hold duration (15 minutes), so "past" must predate now by more
  // than that for the resulting hold to already be expired.
  const past = new Date(Date.now() - 20 * 60 * 1000);

  beforeEach(() => {
    flightRepository = new InMemoryFlightRepository();
    commandBus = { execute: jest.fn(() => Promise.resolve()) };
    worker = new ExpireSeatHoldsWorker(
      flightRepository,
      commandBus as unknown as CommandBus,
    );
  });

  it('queries expired holds with the current timestamp and does nothing when none are found', async () => {
    await worker.handleExpiredHolds();

    expect(flightRepository.findFlightsWithExpiredHolds).toHaveBeenCalledTimes(
      1,
    );
    const [calledWith] =
      flightRepository.findFlightsWithExpiredHolds.mock.calls[0];
    expect(calledWith).toBeInstanceOf(Date);
    expect(calledWith.getTime()).toBeCloseTo(Date.now(), -2);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('dispatches a ReleaseSeatsCommand for each expired hold detected, and skips holds that are not yet expired', async () => {
    const flight = buildFlight('flight-1');
    flight.holdSeats([SeatNumber.create('1A')], 'hold-expired', past);
    flight.pullDomainEvents();
    flightRepository.seed(flight);

    await worker.handleExpiredHolds();

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandBus.execute).toHaveBeenCalledWith(
      new ReleaseSeatsCommand({ flightId: 'flight-1', holdId: 'hold-expired' }),
    );
  });

  it('dispatches one command per expired hold across multiple flights', async () => {
    const flightA = buildFlight('flight-a');
    flightA.holdSeats([SeatNumber.create('1A')], 'hold-a1', past);
    flightA.holdSeats([SeatNumber.create('1B')], 'hold-a2', past);
    flightA.pullDomainEvents();
    flightRepository.seed(flightA);

    const flightB = buildFlight('flight-b');
    flightB.holdSeats([SeatNumber.create('1A')], 'hold-b1', past);
    flightB.pullDomainEvents();
    flightRepository.seed(flightB);

    await worker.handleExpiredHolds();

    expect(commandBus.execute).toHaveBeenCalledTimes(3);
    const dispatchedHoldIds = commandBus.execute.mock.calls
      .map(([command]) => (command as ReleaseSeatsCommand).holdId)
      .sort();
    expect(dispatchedHoldIds).toEqual(['hold-a1', 'hold-a2', 'hold-b1']);
  });

  it('logs an error and continues with remaining holds when one release fails', async () => {
    const errorLogSpy = jest
      .spyOn(worker['logger'], 'error')
      .mockImplementation(() => undefined);

    const flightA = buildFlight('flight-a');
    flightA.holdSeats([SeatNumber.create('1A')], 'hold-a1', past);
    flightA.pullDomainEvents();
    flightRepository.seed(flightA);

    const flightB = buildFlight('flight-b');
    flightB.holdSeats([SeatNumber.create('1A')], 'hold-b1', past);
    flightB.pullDomainEvents();
    flightRepository.seed(flightB);

    commandBus.execute.mockImplementation((command: ReleaseSeatsCommand) => {
      if (command.holdId === 'hold-a1') {
        return Promise.reject(new Error('persistence failure'));
      }
      return Promise.resolve();
    });

    await expect(worker.handleExpiredHolds()).resolves.toBeUndefined();

    expect(commandBus.execute).toHaveBeenCalledTimes(2);
    expect(errorLogSpy).toHaveBeenCalledTimes(1);
    expect(errorLogSpy.mock.calls[0][0]).toContain('hold-a1');
  });

  it('logs an error and returns gracefully when the repository query itself fails', async () => {
    const errorLogSpy = jest
      .spyOn(worker['logger'], 'error')
      .mockImplementation(() => undefined);
    flightRepository.findFlightsWithExpiredHolds.mockImplementationOnce(() =>
      Promise.reject(new Error('database unavailable')),
    );

    await expect(worker.handleExpiredHolds()).resolves.toBeUndefined();

    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(errorLogSpy).toHaveBeenCalledTimes(1);
  });

  it('skips a run that starts while the previous one is still in flight', async () => {
    let resolveFirstQuery!: (flights: Flight[]) => void;
    flightRepository.findFlightsWithExpiredHolds.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstQuery = resolve;
        }),
    );

    const firstRun = worker.handleExpiredHolds();
    const secondRun = worker.handleExpiredHolds();

    resolveFirstQuery([]);
    await Promise.all([firstRun, secondRun]);

    expect(flightRepository.findFlightsWithExpiredHolds).toHaveBeenCalledTimes(
      1,
    );
  });

  it('ignores an unexpired hold entirely', async () => {
    const flight = buildFlight('flight-1');
    flight.holdSeats([SeatNumber.create('1A')], 'hold-future', new Date());
    flight.pullDomainEvents();
    flightRepository.seed(flight);

    await worker.handleExpiredHolds();

    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
