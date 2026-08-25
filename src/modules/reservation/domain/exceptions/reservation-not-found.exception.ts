export class ReservationNotFoundException extends Error {
  constructor(reservationId: string) {
    super(`Reservation "${reservationId}" was not found.`);
    this.name = 'ReservationNotFoundException';
  }
}
