import { randomUUID } from 'crypto';
import { InvalidReservationIdException } from '../exceptions/invalid-reservation-id.exception';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ReservationId {
  private constructor(public readonly value: string) {
    Object.freeze(this);
  }

  // With no value, generates a fresh id; with one, validates it as UUID v4
  // (e.g. when reconstituting from persistence or accepting a client-supplied id).
  static create(value?: string): ReservationId {
    if (value === undefined) {
      return new ReservationId(randomUUID());
    }
    if (!UUID_V4_PATTERN.test(value)) {
      throw new InvalidReservationIdException(value);
    }
    return new ReservationId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ReservationId): boolean {
    return other instanceof ReservationId && this.value === other.value;
  }
}
