import { Money } from '../value-objects/money.vo';
import { SeatAssignment } from '../value-objects/seat-assignment.vo';
import { IDomainEvent } from './domain-event.interface';

export class ReservationCreated implements IDomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly flightId: string,
    public readonly holdId: string,
    public readonly seatAssignments: SeatAssignment[],
    public readonly totalPrice: Money,
    public readonly holdExpiresAt: Date,
    public readonly occurredOn: Date,
  ) {}
}
