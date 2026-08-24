import { SeatClass } from '../value-objects/seat-class.vo';

export class InvalidCapacityException extends Error {
  constructor(seatClass: SeatClass, value: number) {
    super(
      `Invalid capacity for class "${seatClass}": ${value}. Must be a non-negative integer.`,
    );
    this.name = 'InvalidCapacityException';
  }
}
