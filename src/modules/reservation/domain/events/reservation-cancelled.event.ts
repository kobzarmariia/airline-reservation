import { IDomainEvent } from './domain-event.interface';

export class ReservationCancelled implements IDomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly flightId: string,
    public readonly holdId: string,
    public readonly reason: string,
    public readonly occurredOn: Date,
  ) {}
}
