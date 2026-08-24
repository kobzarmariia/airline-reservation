export class SeatsOccupied {
  constructor(
    public readonly flightId: string,
    public readonly holdId: string,
    public readonly seatNumbers: string[],
    public readonly occurredAt: Date = new Date(),
  ) {}
}
