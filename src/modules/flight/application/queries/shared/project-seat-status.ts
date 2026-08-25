import { SeatStatus } from '../../../domain/value-objects/seat-status.vo';

export interface ProjectableSeat {
  status: string;
  holdExpiresAt: Date | null;
}

// A seat can be persisted as HELD past its own hold expiry — nothing writes
// to it between hold creation and the next command or the expiry sweep job
// (see ExpireSeatHoldsWorker). Read models must not surface that stale HELD
// status, so they project it back to AVAILABLE relative to `now` instead of
// waiting for the sweep to catch up.
export function projectSeatStatus(
  seat: ProjectableSeat,
  now: Date,
): SeatStatus {
  if (
    seat.status === (SeatStatus.HELD as string) &&
    seat.holdExpiresAt !== null &&
    seat.holdExpiresAt < now
  ) {
    return SeatStatus.AVAILABLE;
  }
  return seat.status as SeatStatus;
}
