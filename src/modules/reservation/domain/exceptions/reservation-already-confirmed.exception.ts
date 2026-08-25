export class ReservationAlreadyConfirmedException extends Error {
  constructor(reservationId: string) {
    super(`Reservation "${reservationId}" is already confirmed.`);
    this.name = 'ReservationAlreadyConfirmedException';
  }
}
