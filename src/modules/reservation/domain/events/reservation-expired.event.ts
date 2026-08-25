import { IDomainEvent } from './domain-event.interface';

export class ReservationExpired implements IDomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly flightId: string,
    public readonly holdId: string,
    public readonly occurredOn: Date,
  ) {}
}
