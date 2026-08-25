import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfirmReservationHandler } from './confirm-reservation.handler';
import { ConfirmReservationCommand } from './confirm-reservation.command';
import { ReservationRepositoryPort } from '../../../domain/repositories/reservation.repository.interface';
import {
  ProcessPaymentInput,
  ProcessPaymentResult,
} from '../../ports/payment-gateway.port';
import { PaymentFailedException } from '../../exceptions/payment-failed.exception';
import { Reservation } from '../../../domain/models/reservation.aggregate';
import { ReservationId } from '../../../domain/value-objects/reservation-id.vo';
import { SeatAssignment } from '../../../domain/value-objects/seat-assignment.vo';
import { PassengerInfo } from '../../../domain/value-objects/passenger-info.vo';
import { Money } from '../../../domain/value-objects/money.vo';
import { ReservationNotFoundException } from '../../../domain/exceptions/reservation-not-found.exception';
import { ConfirmSeatsCommand } from '../../../../flight/application/commands/confirm-seats/confirm-seats.command';

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
  let paymentGateway: {
    charge: jest.Mock<
      (input: ProcessPaymentInput) => Promise<ProcessPaymentResult>
    >;
  };
  let commandBus: { execute: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let handler: ConfirmReservationHandler;

  beforeEach(() => {
    reservationRepository = new InMemoryReservationRepository();
    paymentGateway = { charge: jest.fn() };
    commandBus = { execute: jest.fn(() => Promise.resolve(undefined)) };
    eventEmitter = { emit: jest.fn() };
    handler = new ConfirmReservationHandler(
      reservationRepository,
      paymentGateway,
      commandBus as never,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('charges payment, confirms the reservation, confirms seats, persists, and dispatches ReservationConfirmed', async () => {
    const reservation = buildPendingReservation();
    reservationRepository.seed(reservation);
    paymentGateway.charge.mockResolvedValueOnce({
      success: true,
      paymentId: 'pay_123',
    });
    const command = new ConfirmReservationCommand({
      reservationId: reservation.getId().value,
      paymentMethodToken: 'tok_visa',
    });

    const result = await handler.execute(command);

    expect(paymentGateway.charge).toHaveBeenCalledWith({
      reservationId: reservation.getId().value,
      amount: 15000,
      currency: 'USD',
      paymentMethodToken: 'tok_visa',
    });

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const confirmSeatsCommand = commandBus.execute.mock
      .calls[0][0] as ConfirmSeatsCommand;
    expect(confirmSeatsCommand).toBeInstanceOf(ConfirmSeatsCommand);
    expect(confirmSeatsCommand).toMatchObject({
      flightId: 'flight-1',
      holdId: 'hold-1',
    });

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

  it('throws ReservationNotFoundException and does not charge when the reservation does not exist', async () => {
    const command = new ConfirmReservationCommand({
      reservationId: ReservationId.create().value,
      paymentMethodToken: 'tok_visa',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      ReservationNotFoundException,
    );
    expect(paymentGateway.charge).not.toHaveBeenCalled();
    expect(reservationRepository.save).not.toHaveBeenCalled();
  });

  it('bubbles PaymentFailedException and leaves the reservation unconfirmed and unpersisted when payment fails', async () => {
    const reservation = buildPendingReservation();
    reservationRepository.seed(reservation);
    paymentGateway.charge.mockResolvedValue({
      success: false,
      failureReason: 'Card declined.',
    });
    const command = new ConfirmReservationCommand({
      reservationId: reservation.getId().value,
      paymentMethodToken: 'tok_fail',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      PaymentFailedException,
    );
    await expect(handler.execute(command)).rejects.toThrow('Card declined.');

    expect(reservation.getStatus()).toBe('PENDING');
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(reservationRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
