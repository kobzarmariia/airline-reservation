export class SeatNotAvailableException extends Error {
  constructor(seatNumber: string) {
    super(`Seat "${seatNumber}" is not available.`);
    this.name = 'SeatNotAvailableException';
  }
}
