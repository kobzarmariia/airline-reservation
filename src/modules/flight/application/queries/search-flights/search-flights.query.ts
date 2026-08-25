export interface SearchFlightsQueryProps {
  origin?: string;
  destination?: string;
  departureDate?: Date;
  minAvailableSeats?: number;
}

export class SearchFlightsQuery {
  readonly origin?: string;
  readonly destination?: string;
  readonly departureDate?: Date;
  readonly minAvailableSeats?: number;

  constructor(props: SearchFlightsQueryProps) {
    this.origin = props.origin;
    this.destination = props.destination;
    this.departureDate = props.departureDate;
    this.minAvailableSeats = props.minAvailableSeats;
    Object.freeze(this);
  }
}
