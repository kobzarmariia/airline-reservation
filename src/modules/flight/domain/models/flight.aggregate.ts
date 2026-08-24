import { FlightId } from '../value-objects/flight-id.vo';
import { FlightNumber } from '../value-objects/flight-number.vo';
import { Route } from '../value-objects/route.vo';
import { Schedule } from '../value-objects/schedule.vo';
import { Capacity } from '../value-objects/capacity.vo';
import { SeatNumber } from '../value-objects/seat-number.vo';
import { Seat } from './seat.entity';
import { SeatsHeld } from '../events/seats-held.event';
import { SeatsReleased } from '../events/seats-released.event';
import { SeatsOccupied } from '../events/seats-occupied.event';
import { FlightAlreadyDepartedException } from '../exceptions/flight-already-departed.exception';
import { SeatNotFoundException } from '../exceptions/seat-not-found.exception';
import { SeatNotAvailableException } from '../exceptions/seat-not-available.exception';
import { SeatHoldPolicy } from '../policies/seat-hold.policy';

export type FlightDomainEvent = SeatsHeld | SeatsReleased | SeatsOccupied;

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

  public releaseSeats(seatNumbers: SeatNumber[], holdId: string): void {
    const releasedSeatNumbers: string[] = [];

    for (const seatNumber of seatNumbers) {
      const seat = this.seats.get(seatNumber.value);
      if (seat && seat.isHeldBy(holdId)) {
        seat.release();
        releasedSeatNumbers.push(seatNumber.value);
      }
    }

    if (releasedSeatNumbers.length > 0) {
      this.domainEvents.push(
        new SeatsReleased(this.id.value, holdId, releasedSeatNumbers),
      );
    }
  }

  public occupySeats(seatNumbers: SeatNumber[], holdId: string): void {
    for (const seatNumber of seatNumbers) {
      const seat = this.seats.get(seatNumber.value);
      if (!seat || !seat.isHeldBy(holdId)) {
        throw new SeatNotAvailableException(seatNumber.value);
      }
      seat.occupy();
    }

    this.domainEvents.push(
      new SeatsOccupied(
        this.id.value,
        holdId,
        seatNumbers.map((seatNumber) => seatNumber.value),
      ),
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
