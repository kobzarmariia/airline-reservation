export const FLIGHT_INVENTORY_PORT = Symbol('FlightInventoryPort');

export interface FlightSeatPrice {
  readonly seatNumber: string;
  readonly amountMinorUnits: number;
  readonly currency: string;
}

// Anti-Corruption Layer for everything the Reservation context needs from
// the Flight context.
export interface FlightInventoryPort {
  getSeatPrices(
    flightId: string,
    seatNumbers: string[],
  ): Promise<FlightSeatPrice[]>;

  confirmSeats(flightId: string, holdId: string): Promise<void>;

  releaseSeats(flightId: string, holdId: string): Promise<void>;
}
