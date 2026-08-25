export class ReservationExpiredException extends Error {
  constructor(reservationId: string) {
    super(
      `Reservation "${reservationId}" has expired and can no longer be confirmed.`,
    );
    this.name = 'ReservationExpiredException';
  }
}
