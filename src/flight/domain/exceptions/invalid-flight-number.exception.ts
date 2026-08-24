export class InvalidFlightNumberException extends Error {
  constructor(value: string) {
    super(
      `Invalid flight number: "${value}". Expected format like "LH1234" (2 letters followed by 3-4 digits).`,
    );
    this.name = 'InvalidFlightNumberException';
  }
}
