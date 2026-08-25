import { IDomainEvent } from './domain-event.interface';

export class ReservationConfirmed implements IDomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly flightId: string,
    public readonly paymentId: string,
    public readonly occurredOn: Date,
  ) {}
}
