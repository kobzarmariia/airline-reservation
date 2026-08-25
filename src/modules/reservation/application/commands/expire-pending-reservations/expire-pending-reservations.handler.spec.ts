import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ExpirePendingReservationsHandler } from './expire-pending-reservations.handler';
import { ExpirePendingReservationsCommand } from './expire-pending-reservations.command';
import { ReservationRepositoryPort } from '../../../domain/repositories/reservation.repository.interface';
import { Reservation } from '../../../domain/models/reservation.aggregate';
import { ReservationId } from '../../../domain/value-objects/reservation-id.vo';
import { ReservationStatus } from '../../../domain/value-objects/reservation-status.vo';
import { SeatAssignment } from '../../../domain/value-objects/seat-assignment.vo';
import { PassengerInfo } from '../../../domain/value-objects/passenger-info.vo';
import { Money } from '../../../domain/value-objects/money.vo';
import { ConcurrencyConflictException } from '../../../domain/exceptions/concurrency-conflict.exception';
import { ReleaseSeatsCommand } from '../../../../flight/application/commands/release-seats/release-seats.command';

class InMemoryReservationRepository implements ReservationRepositoryPort {
  private readonly reservationsById = new Map<string, Reservation>();
  readonly save = jest.fn((reservation: Reservation): Promise<void> => {
    this.reservationsById.set(reservation.getId().value, reservation);
    return Promise.resolve();
  });

  readonly findExpiredPending = jest.fn((now: Date): Promise<Reservation[]> => {
    const expired = Array.from(this.reservationsById.values()).filter(
      (reservation) =>
        reservation.getStatus() === ReservationStatus.PENDING &&
        reservation.getHoldExpiresAt() < now,
    );
    return Promise.resolve(expired);
  });

  seed(reservation: Reservation): void {
    this.reservationsById.set(reservation.getId().value, reservation);
  }

  findById(id: ReservationId): Promise<Reservation | null> {
    return Promise.resolve(this.reservationsById.get(id.value) ?? null);
  }

  findByHoldId(): Promise<Reservation | null> {
    return Promise.resolve(null);
  }
}

function buildPendingReservation(
  flightId: string,
  holdId: string,
  holdExpiresAt: Date,
): Reservation {
  const reservation = Reservation.create({
    flightId,
    holdId,
    seatAssignments: [
      SeatAssignment.create(
        '1A',
        PassengerInfo.create({
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
        }),
        Money.create(15000, 'USD'),
      ),
    ],
    holdExpiresAt,
    now: new Date(),
  });
  reservation.pullDomainEvents();
  return reservation;
}

describe('ExpirePendingReservationsHandler', () => {
  let reservationRepository: InMemoryReservationRepository;
  let commandBus: { execute: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let handler: ExpirePendingReservationsHandler;

  const past = new Date(Date.now() - 10 * 60 * 1000);
  const now = new Date();

  beforeEach(() => {
    reservationRepository = new InMemoryReservationRepository();
    commandBus = { execute: jest.fn(() => Promise.resolve(undefined)) };
    eventEmitter = { emit: jest.fn() };
    handler = new ExpirePendingReservationsHandler(
      reservationRepository,
      commandBus as never,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('queries expired pending reservations with the command timestamp and returns 0 when none are found', async () => {
    const result = await handler.execute(
      new ExpirePendingReservationsCommand(now),
    );

    expect(reservationRepository.findExpiredPending).toHaveBeenCalledWith(now);
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });

  it('expires each found reservation, persists it, releases its seat hold, and emits its domain events', async () => {
    const reservation = buildPendingReservation('flight-1', 'hold-1', past);
    reservationRepository.seed(reservation);

    const result = await handler.execute(
      new ExpirePendingReservationsCommand(now),
    );

    expect(result).toBe(1);
    expect(reservation.getStatus()).toBe('EXPIRED');

    expect(reservationRepository.save).toHaveBeenCalledTimes(1);
    const savedReservation = reservationRepository.save.mock.calls[0][0];
    expect(savedReservation.getStatus()).toBe('EXPIRED');

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandBus.execute).toHaveBeenCalledWith(
      new ReleaseSeatsCommand({ flightId: 'flight-1', holdId: 'hold-1' }),
    );

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    const [eventName] = eventEmitter.emit.mock.calls[0] as [string];
    expect(eventName).toBe('ReservationExpired');
  });

  it('processes one reservation per expired hold across multiple reservations', async () => {
    const reservationA = buildPendingReservation('flight-a', 'hold-a', past);
    const reservationB = buildPendingReservation('flight-b', 'hold-b', past);
    reservationRepository.seed(reservationA);
    reservationRepository.seed(reservationB);

    const result = await handler.execute(
      new ExpirePendingReservationsCommand(now),
    );

    expect(result).toBe(2);
    expect(commandBus.execute).toHaveBeenCalledTimes(2);
    const dispatchedHoldIds = commandBus.execute.mock.calls
      .map(([command]) => (command as ReleaseSeatsCommand).holdId)
      .sort();
    expect(dispatchedHoldIds).toEqual(['hold-a', 'hold-b']);
  });

  it('logs the failure, skips releasing that hold, and continues with the rest of the batch when save throws a concurrency conflict', async () => {
    const errorLogSpy = jest
      .spyOn(handler['logger'], 'error')
      .mockImplementation(() => undefined);

    const reservationA = buildPendingReservation('flight-a', 'hold-a', past);
    const reservationB = buildPendingReservation('flight-b', 'hold-b', past);
    reservationRepository.seed(reservationA);
    reservationRepository.seed(reservationB);

    reservationRepository.save.mockImplementation(
      (reservation: Reservation): Promise<void> => {
        if (reservation.getId().value === reservationA.getId().value) {
          return Promise.reject(
            new ConcurrencyConflictException(reservationA.getId().value),
          );
        }
        return Promise.resolve();
      },
    );

    const result = await handler.execute(
      new ExpirePendingReservationsCommand(now),
    );

    expect(result).toBe(1);
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandBus.execute).toHaveBeenCalledWith(
      new ReleaseSeatsCommand({ flightId: 'flight-b', holdId: 'hold-b' }),
    );
    expect(errorLogSpy).toHaveBeenCalledTimes(1);
    expect(errorLogSpy.mock.calls[0][0]).toContain(reservationA.getId().value);
  });
});
