import { Flight } from '../models/flight.aggregate';

export interface FlightRepository {
  findById(id: string): Promise<Flight | null>;
  save(flight: Flight): Promise<void>;
}
