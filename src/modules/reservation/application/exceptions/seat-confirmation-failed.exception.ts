export class SeatConfirmationFailedException extends Error {
  constructor(
    public readonly reservationId: string,
    public readonly paymentId: string,
    public readonly refunded: boolean,
    public readonly cause: unknown,
  ) {
    super(
      refunded
        ? `Seat confirmation failed for reservation "${reservationId}" after payment "${paymentId}" was captured; the payment has been refunded.`
        : `Seat confirmation failed for reservation "${reservationId}" after payment "${paymentId}" was captured, and the automatic refund also failed. Manual reconciliation is required.`,
    );
    this.name = 'SeatConfirmationFailedException';
  }
}
