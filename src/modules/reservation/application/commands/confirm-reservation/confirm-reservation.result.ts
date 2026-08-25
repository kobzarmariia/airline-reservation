import { ReservationStatus } from '../../../domain/value-objects/reservation-status.vo';

export interface ConfirmReservationResult {
  readonly reservationId: string;
  readonly status: ReservationStatus.CONFIRMED;
  readonly paymentId: string;
}
