import { Flight } from '../models/flight.aggregate';
import { FlightId } from '../value-objects/flight-id.vo';
import { FlightNumber } from '../value-objects/flight-number.vo';

export const FLIGHT_REPOSITORY_PORT = Symbol('FLIGHT_REPOSITORY_PORT');

export interface FlightRepositoryPort {
  save(flight: Flight): Promise<void>;
  findById(id: FlightId): Promise<Flight | null>;
  findByFlightNumberAndDate(
    flightNumber: FlightNumber,
    departureDate: Date,
  ): Promise<Flight | null>;
}
