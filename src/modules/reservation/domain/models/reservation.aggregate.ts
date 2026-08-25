import { ReservationId } from '../value-objects/reservation-id.vo';
import { ReservationStatus } from '../value-objects/reservation-status.vo';
import { SeatAssignment } from '../value-objects/seat-assignment.vo';
import { Money } from '../value-objects/money.vo';
import { IDomainEvent } from '../events/domain-event.interface';
import { ReservationCreated } from '../events/reservation-created.event';
import { ReservationConfirmed } from '../events/reservation-confirmed.event';
import { ReservationCancelled } from '../events/reservation-cancelled.event';
import { ReservationExpired } from '../events/reservation-expired.event';
import { ReservationAlreadyConfirmedException } from '../exceptions/reservation-already-confirmed.exception';
import { ReservationExpiredException } from '../exceptions/reservation-expired.exception';
import { InvalidReservationStatusTransitionException } from '../exceptions/invalid-reservation-status-transition.exception';
import { InvalidPassengerAssignmentException } from '../exceptions/invalid-passenger-assignment.exception';

export interface CreateReservationProps {
  id?: ReservationId;
  flightId: string;
  holdId: string;
  seatAssignments: SeatAssignment[];
  holdExpiresAt: Date;
  now: Date;
}

export interface ReconstituteReservationProps {
  id: ReservationId;
  flightId: string;
  holdId: string;
  seatAssignments: SeatAssignment[];
  totalPrice: Money;
  status: ReservationStatus;
  holdExpiresAt: Date;
  paymentId: string | null;
  cancellationReason: string | null;
  version: number;
}

export type ReservationDomainEvent =
  | ReservationCreated
  | ReservationConfirmed
  | ReservationCancelled
  | ReservationExpired;

export class Reservation {
  private domainEvents: IDomainEvent[] = [];

  private constructor(
    private readonly id: ReservationId,
    private readonly flightId: string,
    private readonly holdId: string,
    private readonly seatAssignments: SeatAssignment[],
    private readonly totalPrice: Money,
    private status: ReservationStatus,
    private readonly holdExpiresAt: Date,
    private paymentId: string | null,
    private cancellationReason: string | null,
    private version: number,
  ) {}

  static create(props: CreateReservationProps): Reservation {
    Reservation.assertValidAssignments(props.seatAssignments);

    const totalPrice = Reservation.calculateTotalPrice(props.seatAssignments);
    const id = props.id ?? ReservationId.create();

    const reservation = new Reservation(
      id,
      props.flightId,
      props.holdId,
      props.seatAssignments,
      totalPrice,
      ReservationStatus.PENDING,
      props.holdExpiresAt,
      null,
      null,
      0,
    );

    reservation.domainEvents.push(
      new ReservationCreated(
        id.value,
        props.flightId,
        props.holdId,
        props.seatAssignments,
        totalPrice,
        props.holdExpiresAt,
        props.now,
      ),
    );

    return reservation;
  }

  // Rebuilds a Reservation from persisted state without emitting domain creation events.
  static reconstitute(props: ReconstituteReservationProps): Reservation {
    return new Reservation(
      props.id,
      props.flightId,
      props.holdId,
      props.seatAssignments,
      props.totalPrice,
      props.status,
      props.holdExpiresAt,
      props.paymentId,
      props.cancellationReason,
      props.version,
    );
  }

  confirm(paymentId: string, now: Date): void {
    if (this.status !== ReservationStatus.PENDING) {
      throw new InvalidReservationStatusTransitionException(
        this.status,
        ReservationStatus.CONFIRMED,
      );
    }
    if (now > this.holdExpiresAt) {
      throw new ReservationExpiredException(this.id.value);
    }

    this.status = ReservationStatus.CONFIRMED;
    this.paymentId = paymentId;

    this.domainEvents.push(
      new ReservationConfirmed(this.id.value, this.flightId, paymentId, now),
    );
  }

  cancel(reason: string, now: Date): void {
    if (this.status === ReservationStatus.CONFIRMED) {
      throw new ReservationAlreadyConfirmedException(this.id.value);
    }
    if (this.status === ReservationStatus.CANCELLED) {
      throw new InvalidReservationStatusTransitionException(
        this.status,
        ReservationStatus.CANCELLED,
      );
    }

    this.status = ReservationStatus.CANCELLED;
    this.cancellationReason = reason;

    this.domainEvents.push(
      new ReservationCancelled(
        this.id.value,
        this.flightId,
        this.holdId,
        reason,
        now,
      ),
    );
  }

  expire(now: Date): void {
    if (this.status !== ReservationStatus.PENDING) {
      throw new InvalidReservationStatusTransitionException(
        this.status,
        ReservationStatus.EXPIRED,
      );
    }
    if (now < this.holdExpiresAt) {
      throw new InvalidReservationStatusTransitionException(
        this.status,
        ReservationStatus.EXPIRED,
      );
    }

    this.status = ReservationStatus.EXPIRED;

    this.domainEvents.push(
      new ReservationExpired(this.id.value, this.flightId, this.holdId, now),
    );
  }

  private static assertValidAssignments(
    seatAssignments: SeatAssignment[],
  ): void {
    if (seatAssignments.length === 0) {
      throw new InvalidPassengerAssignmentException(
        'A reservation must include at least one seat assignment.',
      );
    }

    const seatNumbers = new Set(seatAssignments.map((a) => a.seatNumber));
    if (seatNumbers.size !== seatAssignments.length) {
      throw new InvalidPassengerAssignmentException(
        'Duplicate seat numbers are not allowed within a single reservation.',
      );
    }

    const passengerEmails = new Set(
      seatAssignments.map((a) => a.passenger.email),
    );
    if (passengerEmails.size !== seatAssignments.length) {
      throw new InvalidPassengerAssignmentException(
        'Each passenger may be assigned to only one seat: seat count must match distinct passenger count.',
      );
    }
  }

  private static calculateTotalPrice(seatAssignments: SeatAssignment[]): Money {
    return seatAssignments.reduce(
      (total, assignment) => total.add(assignment.price),
      Money.zero(seatAssignments[0].price.currency),
    );
  }

  getId(): ReservationId {
    return this.id;
  }

  getFlightId(): string {
    return this.flightId;
  }

  getHoldId(): string {
    return this.holdId;
  }

  getSeatAssignments(): SeatAssignment[] {
    return [...this.seatAssignments];
  }

  getTotalPrice(): Money {
    return this.totalPrice;
  }

  getStatus(): ReservationStatus {
    return this.status;
  }

  getHoldExpiresAt(): Date {
    return this.holdExpiresAt;
  }

  getPaymentId(): string | null {
    return this.paymentId;
  }

  getCancellationReason(): string | null {
    return this.cancellationReason;
  }

  getVersion(): number {
    return this.version;
  }

  // Called by the repository once persistence has confirmed the write, so
  // the in-memory aggregate reflects the version now stored in the database.
  incrementVersion(): void {
    this.version += 1;
  }

  pullDomainEvents(): IDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
