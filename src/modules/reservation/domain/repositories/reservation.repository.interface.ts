import { Reservation } from '../models/reservation.aggregate';
import { ReservationId } from '../value-objects/reservation-id.vo';

export const RESERVATION_REPOSITORY_PORT = Symbol(
  'RESERVATION_REPOSITORY_PORT',
);

export interface ReservationRepositoryPort {
  save(reservation: Reservation): Promise<void>;
  findById(id: ReservationId): Promise<Reservation | null>;
  findByHoldId(holdId: string): Promise<Reservation | null>;
  findExpiredPending(now: Date): Promise<Reservation[]>;
}
