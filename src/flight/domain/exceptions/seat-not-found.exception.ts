export class SeatNotFoundException extends Error {
  constructor(seatNumber: string) {
    super(`Seat "${seatNumber}" does not exist on this flight.`);
    this.name = 'SeatNotFoundException';
  }
}
