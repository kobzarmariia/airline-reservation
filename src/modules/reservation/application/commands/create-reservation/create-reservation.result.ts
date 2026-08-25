import { Money } from '../../../domain/value-objects/money.vo';

export interface CreateReservationResult {
  readonly reservationId: string;
  readonly status: string;
  readonly totalPrice: Money;
  readonly holdExpiresAt: Date;
}
