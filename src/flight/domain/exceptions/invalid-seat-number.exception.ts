export class InvalidSeatNumberException extends Error {
  constructor(value: string) {
    super(
      `Invalid seat number: "${value}". Expected format like "12A" (row number followed by a seat letter).`,
    );
    this.name = 'InvalidSeatNumberException';
  }
}
