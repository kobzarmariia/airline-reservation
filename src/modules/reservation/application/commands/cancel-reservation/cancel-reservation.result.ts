import { ReservationStatus } from '../../../domain/value-objects/reservation-status.vo';

export interface CancelReservationResult {
  readonly reservationId: string;
  readonly status: ReservationStatus.CANCELLED;
}
