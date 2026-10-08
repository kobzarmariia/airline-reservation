export const ROUTE_GRAPH_PORT = Symbol('RouteGraphPort');

export interface RouteLeg {
  readonly flightId: string;
  readonly flightNumber: string;
  readonly origin: string;
  readonly destination: string;
  readonly departureTime: Date;
  readonly arrivalTime: Date;
  readonly price: number;
}

export interface CheapestRoute {
  readonly legs: RouteLeg[];
  readonly totalPrice: number;
  readonly stops: number;
}

// Query-side port for the Neo4j-backed route graph read model. Origin and
// destination are matched against an Airport's IATA code, city, or country
// (case-insensitively), so "JFK", "New York", and "United States" all
// resolve to a set of candidate airports rather than a single exact match.
export interface RouteGraphPort {
  findCheapestRoute(
    origin: string,
    destination: string,
    maxStops: number,
  ): Promise<CheapestRoute | null>;
}
