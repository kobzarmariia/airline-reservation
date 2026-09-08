import { Inject, Injectable, Logger } from '@nestjs/common';
import { PAYMENT_GATEWAY_PORT } from '../ports/payment-gateway.port';
import type { PaymentGatewayPort } from '../ports/payment-gateway.port';
import { FLIGHT_INVENTORY_PORT } from '../ports/flight-inventory.port';
import type { FlightInventoryPort } from '../ports/flight-inventory.port';
import { PaymentFailedException } from '../exceptions/payment-failed.exception';
import { SeatConfirmationFailedException } from '../exceptions/seat-confirmation-failed.exception';
import { Reservation } from '../../domain/models/reservation.aggregate';

export interface ConfirmReservationSagaResult {
  readonly paymentId: string;
}

type CompensationKind = 'refund-payment' | 'release-seats';

interface Compensation {
  readonly kind: CompensationKind;
  readonly describe: string;
  execute(): Promise<void>;
}

const REFUND_REASON = 'Seat confirmation failed after payment capture.';

@Injectable()
export class ConfirmReservationSaga {
  private readonly logger = new Logger(ConfirmReservationSaga.name);

  constructor(
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly paymentGateway: PaymentGatewayPort,
    @Inject(FLIGHT_INVENTORY_PORT)
    private readonly flightInventory: FlightInventoryPort,
  ) {}

  async run(
    reservation: Reservation,
    paymentMethodToken: string,
  ): Promise<ConfirmReservationSagaResult> {
    const totalPrice = reservation.getTotalPrice();
    const compensations: Compensation[] = [];
    let capturedPaymentId: string | null = null;

    try {
      const paymentResult = await this.paymentGateway.charge({
        reservationId: reservation.getId().value,
        amount: totalPrice.amount,
        currency: totalPrice.currency,
        paymentMethodToken,
      });

      if (!paymentResult.success) {
        throw new PaymentFailedException(paymentResult.failureReason);
      }

      capturedPaymentId = paymentResult.paymentId;
      compensations.push(
        this.refundCompensation(
          paymentResult.paymentId,
          totalPrice.amount,
          totalPrice.currency,
        ),
      );

      await this.flightInventory.confirmSeats(
        reservation.getFlightId(),
        reservation.getHoldId(),
      );
      compensations.push(
        this.releaseSeatsCompensation(
          reservation.getFlightId(),
          reservation.getHoldId(),
        ),
      );

      reservation.confirm(paymentResult.paymentId, new Date());

      return { paymentId: paymentResult.paymentId };
    } catch (error) {
      if (capturedPaymentId === null) {
        // Failure before any payment was captured (e.g. the charge was
        // declined): there is nothing to compensate.
        throw error;
      }

      const { refunded } = await this.runCompensations(compensations);
      throw new SeatConfirmationFailedException(
        reservation.getId().value,
        capturedPaymentId,
        refunded,
        error,
      );
    }
  }

  private refundCompensation(
    paymentId: string,
    amount: number,
    currency: string,
  ): Compensation {
    return {
      kind: 'refund-payment',
      describe: `refund of payment "${paymentId}"`,
      execute: async () => {
        const result = await this.paymentGateway.refund({
          paymentId,
          amount,
          currency,
          reason: REFUND_REASON,
        });
        if (!result.success) {
          throw new Error(`Refund was declined: ${result.failureReason}`);
        }
      },
    };
  }

  private releaseSeatsCompensation(
    flightId: string,
    holdId: string,
  ): Compensation {
    return {
      kind: 'release-seats',
      describe: `release of hold "${holdId}" on flight "${flightId}"`,
      execute: () => this.flightInventory.releaseSeats(flightId, holdId),
    };
  }

  // Runs compensations newest-first. A compensation that itself fails is
  // logged and does not stop the rest.
  private async runCompensations(
    compensations: Compensation[],
  ): Promise<{ refunded: boolean }> {
    let refunded = false;

    for (const compensation of [...compensations].reverse()) {
      try {
        await compensation.execute();
        if (compensation.kind === 'refund-payment') {
          refunded = true;
        }
      } catch (error) {
        this.logger.error(
          `Compensation failed (${compensation.describe}).`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return { refunded };
  }
}
