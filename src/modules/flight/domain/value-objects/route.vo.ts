import { InvalidRouteException } from '../exceptions/invalid-route.exception';

const IATA_CODE_PATTERN = /^[A-Z]{3}$/;

export class Route {
  private constructor(
    public readonly origin: string,
    public readonly destination: string,
  ) {}

  static create(origin: string, destination: string): Route {
    const normalizedOrigin = origin.trim().toUpperCase();
    const normalizedDestination = destination.trim().toUpperCase();
    const isValidPair =
      IATA_CODE_PATTERN.test(normalizedOrigin) &&
      IATA_CODE_PATTERN.test(normalizedDestination) &&
      normalizedOrigin !== normalizedDestination;
    if (!isValidPair) {
      throw new InvalidRouteException(origin, destination);
    }
    return new Route(normalizedOrigin, normalizedDestination);
  }

  equals(other: Route): boolean {
    return (
      other instanceof Route &&
      this.origin === other.origin &&
      this.destination === other.destination
    );
  }
}
