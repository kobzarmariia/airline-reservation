import { InvalidSeatAssignmentException } from '../exceptions/invalid-seat-assignment.exception';
import { Money } from './money.vo';
import { PassengerInfo } from './passenger-info.vo';

export class SeatAssignment {
  private constructor(
    public readonly seatNumber: string,
    public readonly passenger: PassengerInfo,
    public readonly price: Money,
  ) {
    Object.freeze(this);
  }

  static create(
    seatNumber: string,
    passenger: PassengerInfo,
    price: Money,
  ): SeatAssignment {
    const normalizedSeatNumber = seatNumber.trim().toUpperCase();
    if (normalizedSeatNumber.length === 0) {
      throw new InvalidSeatAssignmentException(
        'SeatAssignment seatNumber must not be empty.',
      );
    }
    return new SeatAssignment(normalizedSeatNumber, passenger, price);
  }

  equals(other: SeatAssignment): boolean {
    return (
      other instanceof SeatAssignment &&
      this.seatNumber === other.seatNumber &&
      this.passenger.equals(other.passenger) &&
      this.price.equals(other.price)
    );
  }
}
