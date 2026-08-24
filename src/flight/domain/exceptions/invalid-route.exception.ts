export class InvalidRouteException extends Error {
  constructor(origin: string, destination: string) {
    super(
      `Invalid route from "${origin}" to "${destination}". Both must be distinct 3-letter IATA airport codes.`,
    );
    this.name = 'InvalidRouteException';
  }
}
