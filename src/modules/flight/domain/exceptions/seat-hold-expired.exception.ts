export class SeatHoldExpiredException extends Error {
  constructor(holdId: string) {
    super(`Hold "${holdId}" has expired.`);
    this.name = 'SeatHoldExpiredException';
  }
}
