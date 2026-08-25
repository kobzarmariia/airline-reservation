export const RESERVATION_HOLD_DURATION_MINUTES = 15;

// Mirrors the Flight module's seat hold duration (SeatHoldPolicy). By the
// time CreateReservationCommand runs, the seat hold already exists in the
// Flight module — but that module deliberately excludes raw hold-expiry
// timestamps from its seat map projection (FlightSeatMapDto), so the
// Reservation module, as a decoupled bounded context, tracks its own copy
// of this shared business rule rather than reaching across the boundary
// for hold internals that aren't meant to be exposed.
export class ReservationHoldPolicy {
  static resolveExpiresAt(now: Date): Date {
    return new Date(
      now.getTime() + RESERVATION_HOLD_DURATION_MINUTES * 60 * 1000,
    );
  }
}
