export class SeatsHeld {
  constructor(
    public readonly flightId: string,
    public readonly holdId: string,
    public readonly seatNumbers: string[],
    public readonly expiresAt: Date,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
