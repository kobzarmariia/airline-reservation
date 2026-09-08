export class SeatConfirmationUnavailableException extends Error {
  constructor(
    public readonly flightId: string,
    public readonly holdId: string,
    public readonly cause: unknown,
  ) {
    super(
      `Seat confirmation is unavailable for hold "${holdId}" on flight "${flightId}".`,
    );
    this.name = 'SeatConfirmationUnavailableException';
  }
}
