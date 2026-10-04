export interface SearchFlightsQueryProps {
  origin?: string;
  destination?: string;
  departureDate?: Date;
  minAvailableSeats?: number;
  searchText?: string;
}

export class SearchFlightsQuery {
  readonly origin?: string;
  readonly destination?: string;
  readonly departureDate?: Date;
  readonly minAvailableSeats?: number;
  readonly searchText?: string;

  constructor(props: SearchFlightsQueryProps) {
    this.origin = props.origin;
    this.destination = props.destination;
    this.departureDate = props.departureDate;
    this.minAvailableSeats = props.minAvailableSeats;
    this.searchText = props.searchText;
    Object.freeze(this);
  }
}
