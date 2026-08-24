import { InvalidFlightNumberException } from '../exceptions/invalid-flight-number.exception';

const FLIGHT_NUMBER_PATTERN = /^[A-Z]{2}\d{3,4}$/;

export class FlightNumber {
  private constructor(public readonly value: string) {}

  static create(rawValue: string): FlightNumber {
    const normalized = rawValue.trim().toUpperCase();
    if (!FLIGHT_NUMBER_PATTERN.test(normalized)) {
      throw new InvalidFlightNumberException(rawValue);
    }
    return new FlightNumber(normalized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: FlightNumber): boolean {
    return other instanceof FlightNumber && this.value === other.value;
  }
}
