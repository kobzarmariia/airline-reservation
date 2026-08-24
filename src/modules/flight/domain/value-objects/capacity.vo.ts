import { SEAT_CLASSES, SeatClass } from './seat-class.vo';
import { InvalidCapacityException } from '../exceptions/invalid-capacity.exception';

export type CapacityBySeatClass = Record<SeatClass, number>;

export class Capacity {
  private constructor(private readonly bySeatClass: CapacityBySeatClass) {}

  static create(bySeatClass: Partial<CapacityBySeatClass>): Capacity {
    const normalized = {} as CapacityBySeatClass;
    for (const seatClass of SEAT_CLASSES) {
      const value = bySeatClass[seatClass] ?? 0;
      if (!Number.isInteger(value) || value < 0) {
        throw new InvalidCapacityException(seatClass, value);
      }
      normalized[seatClass] = value;
    }
    return new Capacity(normalized);
  }

  forSeatClass(seatClass: SeatClass): number {
    return this.bySeatClass[seatClass];
  }

  get total(): number {
    return SEAT_CLASSES.reduce(
      (sum, seatClass) => sum + this.bySeatClass[seatClass],
      0,
    );
  }
}
