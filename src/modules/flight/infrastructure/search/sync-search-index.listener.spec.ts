import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { SyncSearchIndexListener } from './sync-search-index.listener';
import { Flight } from '../../domain/models/flight.aggregate';
import { Seat } from '../../domain/models/seat.entity';
import { FlightId } from '../../domain/value-objects/flight-id.vo';
import { FlightNumber } from '../../domain/value-objects/flight-number.vo';
import { Route } from '../../domain/value-objects/route.vo';
import { Schedule } from '../../domain/value-objects/schedule.vo';
import { Capacity } from '../../domain/value-objects/capacity.vo';
import { SeatNumber } from '../../domain/value-objects/seat-number.vo';
import { SeatsHeld } from '../../domain/events/seats-held.event';
import { SeatsReleased } from '../../domain/events/seats-released.event';
import type { FlightRepositoryPort } from '../../domain/repositories/flight.repository.interface';
import type { FlightSearchIndexPort } from '../../application/ports/flight-search-index.port';

function buildFlight(): Flight {
  const seats = [
    Seat.create(SeatNumber.create('1A'), 'ECONOMY', 150),
    Seat.create(SeatNumber.create('1B'), 'ECONOMY', 120),
    Seat.create(SeatNumber.create('2A'), 'BUSINESS', 900),
  ];
  return Flight.create(
    FlightId.create('flight-1'),
    FlightNumber.create('LH1234'),
    Route.create('FRA', 'JFK'),
    Schedule.create(
      new Date(Date.now() + 60 * 60 * 1000),
      new Date(Date.now() + 8 * 60 * 60 * 1000),
    ),
    Capacity.create({ ECONOMY: 2, BUSINESS: 1, FIRST: 0 }),
    seats,
  );
}

describe('SyncSearchIndexListener', () => {
  let flightRepository: { findById: jest.Mock };
  let searchIndex: { updateAvailability: jest.Mock };
  let listener: SyncSearchIndexListener;

  beforeEach(() => {
    flightRepository = { findById: jest.fn() };
    searchIndex = { updateAvailability: jest.fn() };
    listener = new SyncSearchIndexListener(
      flightRepository as unknown as FlightRepositoryPort,
      searchIndex as unknown as FlightSearchIndexPort,
    );
  });

  it('recomputes available seat count and lowest price after a SeatsHeld event', async () => {
    const flight = buildFlight();
    flight.holdSeats([SeatNumber.create('1B')], 'hold-1', new Date());
    flightRepository.findById.mockImplementationOnce(() =>
      Promise.resolve(flight),
    );

    await listener.onSeatsHeld(
      new SeatsHeld('flight-1', 'hold-1', ['1B'], new Date()),
    );

    expect(flightRepository.findById).toHaveBeenCalledWith(
      FlightId.create('flight-1'),
    );
    // 1A (150) and 2A (900) remain available; 1B (120, the cheapest) is held.
    expect(searchIndex.updateAvailability).toHaveBeenCalledWith(
      'flight-1',
      2,
      150,
    );
  });

  it('reports null startingPrice when no seats remain available', async () => {
    const flight = buildFlight();
    flight.holdSeats(
      [
        SeatNumber.create('1A'),
        SeatNumber.create('1B'),
        SeatNumber.create('2A'),
      ],
      'hold-1',
      new Date(),
    );
    flightRepository.findById.mockImplementationOnce(() =>
      Promise.resolve(flight),
    );

    await listener.onSeatsHeld(
      new SeatsHeld('flight-1', 'hold-1', ['1A', '1B', '2A'], new Date()),
    );

    expect(searchIndex.updateAvailability).toHaveBeenCalledWith(
      'flight-1',
      0,
      null,
    );
  });

  it('does nothing when the flight no longer exists', async () => {
    flightRepository.findById.mockImplementationOnce(() =>
      Promise.resolve(null),
    );

    await listener.onSeatsReleased(
      new SeatsReleased('flight-1', 'hold-1', ['1A']),
    );

    expect(searchIndex.updateAvailability).not.toHaveBeenCalled();
  });
});
