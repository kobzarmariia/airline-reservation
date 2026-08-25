export class GetFlightSeatMapQuery {
  readonly flightId: string;

  constructor(flightId: string) {
    this.flightId = flightId;
    Object.freeze(this);
  }
}
