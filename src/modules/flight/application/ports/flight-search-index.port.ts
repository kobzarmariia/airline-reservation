export const FLIGHT_SEARCH_INDEX_PORT = Symbol('FlightSearchIndexPort');

export interface AirportSearchFields {
  readonly iata: string;
  readonly name: string;
  readonly city: string;
  readonly country: string;
}

// Read-model projection of a flight, enriched with OpenFlights airport/airline
// reference data so free-text search can match on city, country, and airline
// name rather than only exact IATA codes. Mongo (via Prisma) remains the
// system of record for the Flight aggregate; this document is rebuilt at
// seed time and kept eventually consistent by SyncSearchIndexListener.
export interface FlightSearchDocument {
  readonly flightId: string;
  readonly flightNumber: string;
  readonly airlineName: string;
  readonly origin: AirportSearchFields;
  readonly destination: AirportSearchFields;
  readonly departureTime: string;
  readonly arrivalTime: string;
  readonly totalAvailableSeats: number;
  readonly startingPrice: number | null;
}

export interface FlightSearchCriteria {
  readonly origin?: string;
  readonly destination?: string;
  readonly departureDate?: Date;
  readonly minAvailableSeats?: number;
  // Free-text match against origin/destination airport name, city, country,
  // and airline name (e.g. "Paris" or "Lufthansa") — the reason this read
  // model lives in Elasticsearch rather than Mongo.
  readonly searchText?: string;
}

// Query-side port for the Elasticsearch-backed flight search read model.
export interface FlightSearchIndexPort {
  ensureIndex(): Promise<void>;
  bulkIndex(documents: FlightSearchDocument[]): Promise<void>;
  updateAvailability(
    flightId: string,
    totalAvailableSeats: number,
    startingPrice: number | null,
  ): Promise<void>;
  search(criteria: FlightSearchCriteria): Promise<FlightSearchDocument[]>;
}
