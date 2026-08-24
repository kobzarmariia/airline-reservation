import { randomUUID } from 'crypto';

export class FlightId {
  private constructor(public readonly value: string) {}

  static create(value: string): FlightId {
    const normalized = value.trim();
    if (normalized.length === 0) {
      throw new Error('FlightId cannot be empty.');
    }
    return new FlightId(normalized);
  }

  static generate(): FlightId {
    return new FlightId(randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: FlightId): boolean {
    return other instanceof FlightId && this.value === other.value;
  }
}
