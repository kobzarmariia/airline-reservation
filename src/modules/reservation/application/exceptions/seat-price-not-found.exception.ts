export class SeatPriceNotFoundException extends Error {
  constructor(flightId: string, seatNumber: string) {
    super(
      `No price could be resolved for seat "${seatNumber}" on flight "${flightId}".`,
    );
    this.name = 'SeatPriceNotFoundException';
  }
}
