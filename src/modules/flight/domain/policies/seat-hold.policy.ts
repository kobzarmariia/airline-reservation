export const DEFAULT_HOLD_DURATION_MINUTES = 15;

// Owns the business rule for how long a seat hold lasts. Kept as an explicit
// domain concept (rather than inline arithmetic in the aggregate or, worse,
// a caller-supplied value) so the duration stays a single, centrally-enforced
// invariant regardless of which channel initiates the hold.
export class SeatHoldPolicy {
  static resolveExpiresAt(now: Date): Date {
    return new Date(now.getTime() + DEFAULT_HOLD_DURATION_MINUTES * 60 * 1000);
  }
}
