import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CancelReservationHandler } from './cancel-reservation.handler';
import { CancelReservationCommand } from './cancel-reservation.command';
import { ReservationRepositoryPort } from '../../../domain/repositories/reservation.repository.interface';
import { Reservation } from '../../../domain/models/reservation.aggregate';
import { ReservationId } from '../../../domain/value-objects/reservation-id.vo';
import { SeatAssignment } from '../../../domain/value-objects/seat-assignment.vo';
import { PassengerInfo } from '../../../domain/value-objects/passenger-info.vo';
import { Money } from '../../../domain/value-objects/money.vo';
import { ReservationNotFoundException } from '../../../domain/exceptions/reservation-not-found.exception';
import { ReservationAlreadyConfirmedException } from '../../../domain/exceptions/reservation-already-confirmed.exception';
import { ReleaseSeatsCommand } from '../../../../flight/application/commands/release-seats/release-seats.command';

class InMemoryReservationRepository implements ReservationRepositoryPort {
  private readonly reservationsById = new Map<string, Reservation>();
  readonly save = jest.fn((reservation: Reservation): Promise<void> => {
    this.reservationsById.set(reservation.getId().value, reservation);
    return Promise.resolve();
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

  findExpiredPending(): Promise<Reservation[]> {
    return Promise.resolve([]);
  }
}

function buildPendingReservation(): Reservation {
  const reservation = Reservation.create({
    flightId: 'flight-1',
    holdId: 'hold-1',
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
    holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    now: new Date(),
  });
  reservation.pullDomainEvents();
  return reservation;
}

describe('CancelReservationHandler', () => {
  let reservationRepository: InMemoryReservationRepository;
  let commandBus: { execute: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let handler: CancelReservationHandler;

  beforeEach(() => {
    reservationRepository = new InMemoryReservationRepository();
    commandBus = { execute: jest.fn(() => Promise.resolve(undefined)) };
    eventEmitter = { emit: jest.fn() };
    handler = new CancelReservationHandler(
      reservationRepository,
      commandBus as never,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('cancels the reservation, releases the held seats, persists, and dispatches ReservationCancelled', async () => {
    const reservation = buildPendingReservation();
    reservationRepository.seed(reservation);
    const command = new CancelReservationCommand({
      reservationId: reservation.getId().value,
      reason: 'Passenger requested cancellation.',
    });

    const result = await handler.execute(command);

    expect(result).toEqual({
      reservationId: reservation.getId().value,
      status: 'CANCELLED',
    });

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const releaseCommand = commandBus.execute.mock
      .calls[0][0] as ReleaseSeatsCommand;
    expect(releaseCommand).toBeInstanceOf(ReleaseSeatsCommand);
    expect(releaseCommand).toMatchObject({
      flightId: 'flight-1',
      holdId: 'hold-1',
    });

    expect(reservationRepository.save).toHaveBeenCalledTimes(1);
    const savedReservation = reservationRepository.save.mock.calls[0][0];
    expect(savedReservation.getStatus()).toBe('CANCELLED');
    expect(savedReservation.getCancellationReason()).toBe(
      'Passenger requested cancellation.',
    );

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    const [eventName] = eventEmitter.emit.mock.calls[0] as [string];
    expect(eventName).toBe('ReservationCancelled');
  });

  it('throws ReservationNotFoundException and does not release seats or persist when the reservation does not exist', async () => {
    const command = new CancelReservationCommand({
      reservationId: ReservationId.create().value,
      reason: 'Passenger requested cancellation.',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      ReservationNotFoundException,
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(reservationRepository.save).not.toHaveBeenCalled();
  });

  it('propagates domain invariant violations without releasing seats or persisting', async () => {
    const reservation = buildPendingReservation();
    reservation.confirm('pay_123', new Date());
    reservation.pullDomainEvents();
    reservationRepository.seed(reservation);
    const command = new CancelReservationCommand({
      reservationId: reservation.getId().value,
      reason: 'Passenger requested cancellation.',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      ReservationAlreadyConfirmedException,
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(reservationRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
