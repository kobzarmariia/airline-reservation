import { InvalidSeatNumberException } from '../exceptions/invalid-seat-number.exception';

const SEAT_NUMBER_PATTERN = /^[1-9][0-9]*[A-Z]$/;

export class SeatNumber {
  private constructor(public readonly value: string) {}

  static create(rawValue: string): SeatNumber {
    const normalized = rawValue.trim().toUpperCase();
    if (!SEAT_NUMBER_PATTERN.test(normalized)) {
      throw new InvalidSeatNumberException(rawValue);
    }
    return new SeatNumber(normalized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: SeatNumber): boolean {
    return other instanceof SeatNumber && this.value === other.value;
  }
}
