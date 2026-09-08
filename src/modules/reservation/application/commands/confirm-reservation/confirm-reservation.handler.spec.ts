import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfirmReservationHandler } from './confirm-reservation.handler';
import { ConfirmReservationCommand } from './confirm-reservation.command';
import { ReservationRepositoryPort } from '../../../domain/repositories/reservation.repository.interface';
import { PaymentFailedException } from '../../exceptions/payment-failed.exception';
import { SeatConfirmationFailedException } from '../../exceptions/seat-confirmation-failed.exception';
import { ConfirmReservationSaga } from '../../sagas/confirm-reservation.saga';
import { Reservation } from '../../../domain/models/reservation.aggregate';
import { ReservationId } from '../../../domain/value-objects/reservation-id.vo';
import { SeatAssignment } from '../../../domain/value-objects/seat-assignment.vo';
import { PassengerInfo } from '../../../domain/value-objects/passenger-info.vo';
import { Money } from '../../../domain/value-objects/money.vo';
import { ReservationNotFoundException } from '../../../domain/exceptions/reservation-not-found.exception';

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

describe('ConfirmReservationHandler', () => {
  let reservationRepository: InMemoryReservationRepository;
  let confirmReservationSaga: { run: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let handler: ConfirmReservationHandler;

  beforeEach(() => {
    reservationRepository = new InMemoryReservationRepository();
    confirmReservationSaga = {
      run: jest.fn(() => Promise.resolve({ paymentId: 'pay_123' })),
    };
    eventEmitter = { emit: jest.fn() };
    handler = new ConfirmReservationHandler(
      reservationRepository,
      confirmReservationSaga as unknown as ConfirmReservationSaga,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('runs the saga, persists the confirmed reservation, and dispatches ReservationConfirmed', async () => {
    const reservation = buildPendingReservation();
    reservationRepository.seed(reservation);
    confirmReservationSaga.run.mockImplementationOnce(
      (target: Reservation, token: string) => {
        expect(token).toBe('tok_visa');
        target.confirm('pay_123', new Date());
        return Promise.resolve({ paymentId: 'pay_123' });
      },
    );
    const command = new ConfirmReservationCommand({
      reservationId: reservation.getId().value,
      paymentMethodToken: 'tok_visa',
    });

    const result = await handler.execute(command);

    expect(confirmReservationSaga.run).toHaveBeenCalledTimes(1);

    expect(reservationRepository.save).toHaveBeenCalledTimes(1);
    const savedReservation = reservationRepository.save.mock.calls[0][0];
    expect(savedReservation.getStatus()).toBe('CONFIRMED');
    expect(savedReservation.getPaymentId()).toBe('pay_123');

    expect(result).toEqual({
      reservationId: reservation.getId().value,
      status: 'CONFIRMED',
      paymentId: 'pay_123',
    });

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    const [eventName] = eventEmitter.emit.mock.calls[0] as [string];
    expect(eventName).toBe('ReservationConfirmed');
  });

  it('throws ReservationNotFoundException and does not run the saga when the reservation does not exist', async () => {
    const command = new ConfirmReservationCommand({
      reservationId: ReservationId.create().value,
      paymentMethodToken: 'tok_visa',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      ReservationNotFoundException,
    );
    expect(confirmReservationSaga.run).not.toHaveBeenCalled();
    expect(reservationRepository.save).not.toHaveBeenCalled();
  });

  it('bubbles PaymentFailedException from the saga and never persists or dispatches', async () => {
    const reservation = buildPendingReservation();
    reservationRepository.seed(reservation);
    confirmReservationSaga.run.mockImplementationOnce(() =>
      Promise.reject(new PaymentFailedException('Card declined.')),
    );
    const command = new ConfirmReservationCommand({
      reservationId: reservation.getId().value,
      paymentMethodToken: 'tok_fail',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      PaymentFailedException,
    );

    expect(reservation.getStatus()).toBe('PENDING');
    expect(reservationRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('bubbles SeatConfirmationFailedException from the saga and never persists or dispatches', async () => {
    const reservation = buildPendingReservation();
    reservationRepository.seed(reservation);
    confirmReservationSaga.run.mockImplementationOnce(() =>
      Promise.reject(
        new SeatConfirmationFailedException(
          reservation.getId().value,
          'pay_123',
          true,
          new Error('Hold expired.'),
        ),
      ),
    );
    const command = new ConfirmReservationCommand({
      reservationId: reservation.getId().value,
      paymentMethodToken: 'tok_visa',
    });

    const error = await handler.execute(command).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SeatConfirmationFailedException);
    expect(reservationRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
