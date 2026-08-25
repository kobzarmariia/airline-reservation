import { ReservationStatus } from '../value-objects/reservation-status.vo';

export class InvalidReservationStatusTransitionException extends Error {
  constructor(from: ReservationStatus, to: ReservationStatus) {
    super(`Cannot transition reservation from "${from}" to "${to}".`);
    this.name = 'InvalidReservationStatusTransitionException';
  }
}
