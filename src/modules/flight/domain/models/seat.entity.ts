import { SeatNumber } from '../value-objects/seat-number.vo';
import { SeatClass } from '../value-objects/seat-class.vo';
import { SeatStatus } from '../value-objects/seat-status.vo';

export class Seat {
  private status: SeatStatus = SeatStatus.AVAILABLE;
  private holdId: string | null = null;
  private holdExpiresAt: Date | null = null;

  private constructor(
    public readonly seatNumber: SeatNumber,
    public readonly seatClass: SeatClass,
  ) {}

  static create(seatNumber: SeatNumber, seatClass: SeatClass): Seat {
    return new Seat(seatNumber, seatClass);
  }

  static reconstitute(
    seatNumber: SeatNumber,
    seatClass: SeatClass,
    status: SeatStatus,
    holdId: string | null,
    holdExpiresAt: Date | null,
  ): Seat {
    const seat = new Seat(seatNumber, seatClass);
    seat.status = status;
    seat.holdId = holdId;
    seat.holdExpiresAt = holdExpiresAt;
    return seat;
  }

  isAvailable(): boolean {
    return this.status === SeatStatus.AVAILABLE;
  }

  isHeldBy(holdId: string): boolean {
    return this.status === SeatStatus.HELD && this.holdId === holdId;
  }

  hold(holdId: string, expiresAt: Date): void {
    this.status = SeatStatus.HELD;
    this.holdId = holdId;
    this.holdExpiresAt = expiresAt;
  }

  release(): void {
    this.status = SeatStatus.AVAILABLE;
    this.holdId = null;
    this.holdExpiresAt = null;
  }

  occupy(): void {
    this.status = SeatStatus.OCCUPIED;
    this.holdId = null;
    this.holdExpiresAt = null;
  }

  getStatus(): SeatStatus {
    return this.status;
  }

  getHoldId(): string | null {
    return this.holdId;
  }

  getHoldExpiry(): Date | null {
    return this.holdExpiresAt;
  }
}
