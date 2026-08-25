export class InvalidReservationIdException extends Error {
  constructor(value: string) {
    super(`Invalid reservation id: "${value}". Expected a UUID v4 string.`);
    this.name = 'InvalidReservationIdException';
  }
}
