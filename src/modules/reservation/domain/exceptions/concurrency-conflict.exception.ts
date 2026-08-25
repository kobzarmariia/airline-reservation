export class ConcurrencyConflictException extends Error {
  constructor(reservationId: string) {
    super(
      `Reservation "${reservationId}" was modified by another request. Please retry your operation.`,
    );
    this.name = 'ConcurrencyConflictException';
  }
}
