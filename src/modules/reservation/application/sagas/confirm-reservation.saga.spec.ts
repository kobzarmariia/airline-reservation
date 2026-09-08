import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { ConfirmReservationSaga } from './confirm-reservation.saga';
import {
  ProcessPaymentInput,
  ProcessPaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
} from '../ports/payment-gateway.port';
import { FlightInventoryPort } from '../ports/flight-inventory.port';
import { PaymentFailedException } from '../exceptions/payment-failed.exception';
import { SeatConfirmationFailedException } from '../exceptions/seat-confirmation-failed.exception';
import { SeatConfirmationUnavailableException } from '../exceptions/seat-confirmation-unavailable.exception';
import { Reservation } from '../../domain/models/reservation.aggregate';
import { SeatAssignment } from '../../domain/value-objects/seat-assignment.vo';
import { PassengerInfo } from '../../domain/value-objects/passenger-info.vo';
import { Money } from '../../domain/value-objects/money.vo';

function buildPendingReservation(
  holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000),
): Reservation {
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
    holdExpiresAt,
    now: new Date(),
  });
  reservation.pullDomainEvents();
  return reservation;
}

describe('ConfirmReservationSaga', () => {
  let paymentGateway: {
    charge: jest.Mock<
      (input: ProcessPaymentInput) => Promise<ProcessPaymentResult>
    >;
    refund: jest.Mock<
      (input: RefundPaymentInput) => Promise<RefundPaymentResult>
    >;
  };
  let flightInventory: {
    getSeatPrices: jest.Mock;
    confirmSeats: jest.Mock;
    releaseSeats: jest.Mock;
  };
  let saga: ConfirmReservationSaga;

  beforeEach(() => {
    paymentGateway = { charge: jest.fn(), refund: jest.fn() };
    flightInventory = {
      getSeatPrices: jest.fn(),
      confirmSeats: jest.fn(() => Promise.resolve()),
      releaseSeats: jest.fn(() => Promise.resolve()),
    };
    saga = new ConfirmReservationSaga(
      paymentGateway,
      flightInventory as unknown as FlightInventoryPort,
    );
    jest.spyOn(saga['logger'], 'error').mockImplementation(() => undefined);
  });

  it('charges, confirms seats, and transitions the reservation to CONFIRMED on the happy path', async () => {
    const reservation = buildPendingReservation();
    paymentGateway.charge.mockResolvedValueOnce({
      success: true,
      paymentId: 'pay_123',
    });

    const result = await saga.run(reservation, 'tok_visa');

    expect(result).toEqual({ paymentId: 'pay_123' });
    expect(paymentGateway.charge).toHaveBeenCalledWith({
      reservationId: reservation.getId().value,
      amount: 15000,
      currency: 'USD',
      paymentMethodToken: 'tok_visa',
    });
    expect(flightInventory.confirmSeats).toHaveBeenCalledWith(
      'flight-1',
      'hold-1',
    );
    expect(paymentGateway.refund).not.toHaveBeenCalled();
    expect(flightInventory.releaseSeats).not.toHaveBeenCalled();
    expect(reservation.getStatus()).toBe('CONFIRMED');
    expect(reservation.getPaymentId()).toBe('pay_123');
  });

  it('throws PaymentFailedException without compensating when the charge is declined', async () => {
    const reservation = buildPendingReservation();
    paymentGateway.charge.mockResolvedValueOnce({
      success: false,
      failureReason: 'Card declined.',
    });

    await expect(saga.run(reservation, 'tok_fail')).rejects.toThrow(
      PaymentFailedException,
    );

    expect(flightInventory.confirmSeats).not.toHaveBeenCalled();
    expect(paymentGateway.refund).not.toHaveBeenCalled();
    expect(reservation.getStatus()).toBe('PENDING');
  });

  it('refunds the captured payment and throws SeatConfirmationFailedException when seat confirmation fails', async () => {
    const reservation = buildPendingReservation();
    paymentGateway.charge.mockResolvedValueOnce({
      success: true,
      paymentId: 'pay_123',
    });
    flightInventory.confirmSeats.mockImplementationOnce(() =>
      Promise.reject(
        new SeatConfirmationUnavailableException(
          'flight-1',
          'hold-1',
          new Error('Hold expired.'),
        ),
      ),
    );
    paymentGateway.refund.mockResolvedValueOnce({
      success: true,
      refundId: 'ref_123',
    });

    const error = await saga
      .run(reservation, 'tok_visa')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SeatConfirmationFailedException);
    expect((error as SeatConfirmationFailedException).refunded).toBe(true);
    expect((error as SeatConfirmationFailedException).paymentId).toBe(
      'pay_123',
    );
    expect(paymentGateway.refund).toHaveBeenCalledWith({
      paymentId: 'pay_123',
      amount: 15000,
      currency: 'USD',
      reason: 'Seat confirmation failed after payment capture.',
    });
    // Seats were never confirmed, so there is nothing to release.
    expect(flightInventory.releaseSeats).not.toHaveBeenCalled();
    expect(reservation.getStatus()).toBe('PENDING');
  });

  it('marks the exception as unrefunded when the compensating refund also fails', async () => {
    const reservation = buildPendingReservation();
    paymentGateway.charge.mockResolvedValueOnce({
      success: true,
      paymentId: 'pay_123',
    });
    flightInventory.confirmSeats.mockImplementationOnce(() =>
      Promise.reject(
        new SeatConfirmationUnavailableException(
          'flight-1',
          'hold-1',
          new Error('Hold expired.'),
        ),
      ),
    );
    paymentGateway.refund.mockResolvedValueOnce({
      success: false,
      failureReason: 'Refund gateway unavailable.',
    });

    const error = await saga
      .run(reservation, 'tok_visa')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SeatConfirmationFailedException);
    expect((error as SeatConfirmationFailedException).refunded).toBe(false);
  });

  it('releases the seats and refunds the payment when the aggregate transition fails after seats were confirmed', async () => {
    // Hold already expired from the aggregate's perspective: charge and
    // seat-confirmation both succeed, then reservation.confirm() throws.
    const reservation = buildPendingReservation(
      new Date(Date.now() - 60 * 1000),
    );
    paymentGateway.charge.mockResolvedValueOnce({
      success: true,
      paymentId: 'pay_123',
    });
    paymentGateway.refund.mockResolvedValueOnce({
      success: true,
      refundId: 'ref_123',
    });

    const error = await saga
      .run(reservation, 'tok_visa')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SeatConfirmationFailedException);
    expect((error as SeatConfirmationFailedException).refunded).toBe(true);
    expect(flightInventory.confirmSeats).toHaveBeenCalledTimes(1);
    // Seats were confirmed before the aggregate rejected the transition, so
    // the saga must hand them back.
    expect(flightInventory.releaseSeats).toHaveBeenCalledWith(
      'flight-1',
      'hold-1',
    );
    expect(paymentGateway.refund).toHaveBeenCalledTimes(1);
    expect(reservation.getStatus()).toBe('PENDING');
  });
});
