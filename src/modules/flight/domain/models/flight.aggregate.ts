import { FlightId } from '../value-objects/flight-id.vo';
import { FlightNumber } from '../value-objects/flight-number.vo';
import { Route } from '../value-objects/route.vo';
import { Schedule } from '../value-objects/schedule.vo';
import { Capacity } from '../value-objects/capacity.vo';
import { SeatNumber } from '../value-objects/seat-number.vo';
import { Seat } from './seat.entity';
import { SeatsHeld } from '../events/seats-held.event';
import { SeatsReleased } from '../events/seats-released.event';
import { SeatsConfirmed } from '../events/seats-confirmed.event';
import { FlightAlreadyDepartedException } from '../exceptions/flight-already-departed.exception';
import { SeatNotFoundException } from '../exceptions/seat-not-found.exception';
import { SeatNotAvailableException } from '../exceptions/seat-not-available.exception';
import { HoldNotFoundException } from '../exceptions/hold-not-found.exception';
import { SeatHoldExpiredException } from '../exceptions/seat-hold-expired.exception';
import { SeatHoldPolicy } from '../policies/seat-hold.policy';
import { SeatStatus } from '../value-objects/seat-status.vo';

export type FlightDomainEvent = SeatsHeld | SeatsReleased | SeatsConfirmed;

export class Flight {
  private domainEvents: FlightDomainEvent[] = [];

  private constructor(
    private readonly id: FlightId,
    private readonly flightNumber: FlightNumber,
    private readonly route: Route,
    private readonly schedule: Schedule,
    private readonly capacity: Capacity,
    private seats: Map<string, Seat>, // Keyed by SeatNumber value (e.g., '12A')
  ) {}

  static create(
    id: FlightId,
    flightNumber: FlightNumber,
    route: Route,
    schedule: Schedule,
    capacity: Capacity,
    seats: Seat[],
  ): Flight {
    const seatMap = new Map<string, Seat>();
    for (const seat of seats) {
      seatMap.set(seat.seatNumber.value, seat);
    }
    return new Flight(id, flightNumber, route, schedule, capacity, seatMap);
  }

  // Rebuilds a Flight from persisted state without emitting domain creation events.
  static reconstitute(
    id: FlightId,
    flightNumber: FlightNumber,
    route: Route,
    schedule: Schedule,
    capacity: Capacity,
    seats: Seat[],
  ): Flight {
    const seatMap = new Map<string, Seat>();
    for (const seat of seats) {
      seatMap.set(seat.seatNumber.value, seat);
    }
    return new Flight(id, flightNumber, route, schedule, capacity, seatMap);
  }

  getId(): FlightId {
    return this.id;
  }

  getFlightNumber(): FlightNumber {
    return this.flightNumber;
  }

  getRoute(): Route {
    return this.route;
  }

  getSchedule(): Schedule {
    return this.schedule;
  }

  getCapacity(): Capacity {
    return this.capacity;
  }

  getSeats(): Seat[] {
    return Array.from(this.seats.values());
  }

  public holdSeats(seatNumbers: SeatNumber[], holdId: string, now: Date): Date {
    if (this.schedule.hasDeparted()) {
      throw new FlightAlreadyDepartedException();
    }

    // Invariant: Verify all requested seats exist and are AVAILABLE
    for (const seatNumber of seatNumbers) {
      const seat = this.seats.get(seatNumber.value);
      if (!seat) {
        throw new SeatNotFoundException(seatNumber.value);
      }
      if (!seat.isAvailable()) {
        throw new SeatNotAvailableException(seatNumber.value);
      }
    }

    // How long a hold lasts is a domain rule, not something the caller
    // supplies — the aggregate is the single source of truth for it.
    const expiresAt = SeatHoldPolicy.resolveExpiresAt(now);

    // State transition: Mark seats as HELD
    for (const seatNumber of seatNumbers) {
      const seat = this.seats.get(seatNumber.value)!;
      seat.hold(holdId, expiresAt);
    }

    this.domainEvents.push(
      new SeatsHeld(
        this.id.value,
        holdId,
        seatNumbers.map((seatNumber) => seatNumber.value),
        expiresAt,
      ),
    );

    return expiresAt;
  }

  // Idempotent by design: releasing a holdId that owns no seats (already
  // released, already confirmed, or never existed) is a silent no-op rather
  // than an error, so callers (e.g. a DELETE endpoint) can retry safely.
  public releaseSeats(holdId: string): void {
    const heldSeats = this.getSeatsHeldBy(holdId);
    if (heldSeats.length === 0) {
      return;
    }

    const releasedSeatNumbers: string[] = [];
    for (const seat of heldSeats) {
      seat.release();
      releasedSeatNumbers.push(seat.seatNumber.value);
    }

    this.domainEvents.push(
      new SeatsReleased(this.id.value, holdId, releasedSeatNumbers),
    );
  }

  public confirmSeats(holdId: string, now: Date): void {
    if (this.schedule.hasDeparted(now)) {
      throw new FlightAlreadyDepartedException();
    }

    const heldSeats = this.getSeatsHeldBy(holdId);
    if (heldSeats.length === 0) {
      throw new HoldNotFoundException(holdId);
    }

    for (const seat of heldSeats) {
      const holdExpiresAt = seat.getHoldExpiry();
      if (holdExpiresAt !== null && now > holdExpiresAt) {
        throw new SeatHoldExpiredException(holdId);
      }
    }

    const confirmedSeatNumbers: string[] = [];
    for (const seat of heldSeats) {
      seat.occupy();
      confirmedSeatNumbers.push(seat.seatNumber.value);
    }

    this.domainEvents.push(
      new SeatsConfirmed(this.id.value, holdId, confirmedSeatNumbers),
    );
  }

  public getExpiredHoldIds(now: Date): string[] {
    const expiredHoldIds = new Set<string>();
    for (const seat of this.seats.values()) {
      if (seat.getStatus() !== SeatStatus.HELD) {
        continue;
      }
      const holdId = seat.getHoldId();
      const holdExpiresAt = seat.getHoldExpiry();
      if (holdId !== null && holdExpiresAt !== null && now > holdExpiresAt) {
        expiredHoldIds.add(holdId);
      }
    }
    return Array.from(expiredHoldIds);
  }

  private getSeatsHeldBy(holdId: string): Seat[] {
    return Array.from(this.seats.values()).filter((seat) =>
      seat.isHeldBy(holdId),
    );
  }

  public getAvailableSeatCount(): number {
    return Array.from(this.seats.values()).filter((s) => s.isAvailable())
      .length;
  }

  pullDomainEvents(): FlightDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
