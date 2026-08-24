import { Flight } from './flight.aggregate';
import { it, describe, expect } from '@jest/globals';
import { Seat, SeatStatus } from './seat.entity';
import { FlightId } from '../value-objects/flight-id.vo';
import { FlightNumber } from '../value-objects/flight-number.vo';
import { Route } from '../value-objects/route.vo';
import { Schedule } from '../value-objects/schedule.vo';
import { Capacity } from '../value-objects/capacity.vo';
import { SeatNumber } from '../value-objects/seat-number.vo';
import { SeatsHeld } from '../events/seats-held.event';
import { SeatsReleased } from '../events/seats-released.event';
import { SeatsOccupied } from '../events/seats-occupied.event';
import { FlightAlreadyDepartedException } from '../exceptions/flight-already-departed.exception';
import { SeatNotFoundException } from '../exceptions/seat-not-found.exception';
import { SeatNotAvailableException } from '../exceptions/seat-not-available.exception';

function buildFlight(
  departureTime: Date = new Date(Date.now() + 60 * 60 * 1000),
): Flight {
  const seats = [
    Seat.create(SeatNumber.create('1A'), 'ECONOMY'),
    Seat.create(SeatNumber.create('1B'), 'ECONOMY'),
    Seat.create(SeatNumber.create('2A'), 'BUSINESS'),
  ];
  return Flight.create(
    FlightId.create('flight-1'),
    FlightNumber.create('LH1234'),
    Route.create('FRA', 'JFK'),
    Schedule.create(
      departureTime,
      new Date(departureTime.getTime() + 8 * 60 * 60 * 1000),
    ),
    Capacity.create({ ECONOMY: 2, BUSINESS: 1, FIRST: 0 }),
    seats,
  );
}

const soon = () => new Date(Date.now() + 15 * 60 * 1000);

describe('Flight', () => {
  it('holds available seats and emits exactly one SeatsHeld event', () => {
    const flight = buildFlight();
    const expiresAt = soon();

    flight.holdSeats([SeatNumber.create('1A')], 'hold-1', expiresAt);

    expect(flight.getAvailableSeatCount()).toBe(2);
    const events = flight.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(SeatsHeld);
    expect(events[0]).toMatchObject({
      flightId: 'flight-1',
      holdId: 'hold-1',
      seatNumbers: ['1A'],
      expiresAt,
    });
  });

  it('throws SeatNotFoundException when holding a seat that does not exist on the flight', () => {
    const flight = buildFlight();

    expect(() =>
      flight.holdSeats([SeatNumber.create('9Z')], 'hold-1', soon()),
    ).toThrow(SeatNotFoundException);
    expect(flight.pullDomainEvents()).toHaveLength(0);
  });

  it('throws SeatNotAvailableException when holding an already-held seat', () => {
    const flight = buildFlight();
    flight.holdSeats([SeatNumber.create('1A')], 'hold-1', soon());
    flight.pullDomainEvents();

    expect(() =>
      flight.holdSeats([SeatNumber.create('1A')], 'hold-2', soon()),
    ).toThrow(SeatNotAvailableException);
  });

  it('throws FlightAlreadyDepartedException when holding seats on a departed flight', () => {
    const flight = buildFlight(new Date(Date.now() - 60 * 60 * 1000));

    expect(() =>
      flight.holdSeats([SeatNumber.create('1A')], 'hold-1', soon()),
    ).toThrow(FlightAlreadyDepartedException);
  });

  it('releases seats held by the same holdId, freeing them, and emits SeatsReleased', () => {
    const flight = buildFlight();
    flight.holdSeats(
      [SeatNumber.create('1A'), SeatNumber.create('1B')],
      'hold-1',
      soon(),
    );
    flight.pullDomainEvents();

    flight.releaseSeats([SeatNumber.create('1A')], 'hold-1');

    expect(flight.getAvailableSeatCount()).toBe(2);
    const events = flight.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(SeatsReleased);
    expect(events[0]).toMatchObject({
      flightId: 'flight-1',
      holdId: 'hold-1',
      seatNumbers: ['1A'],
    });
  });

  it('ignores release for seats held by a different holdId and emits no event', () => {
    const flight = buildFlight();
    flight.holdSeats([SeatNumber.create('1A')], 'hold-1', soon());
    flight.pullDomainEvents();

    flight.releaseSeats([SeatNumber.create('1A')], 'hold-2');

    expect(flight.getAvailableSeatCount()).toBe(2);
    expect(flight.pullDomainEvents()).toHaveLength(0);
  });

  it('occupies held seats, transitioning them from HELD to OCCUPIED, and emits SeatsOccupied', () => {
    const flight = buildFlight();
    flight.holdSeats([SeatNumber.create('1A')], 'hold-1', soon());
    flight.pullDomainEvents();

    flight.occupySeats([SeatNumber.create('1A')], 'hold-1');

    const seat = flight.getSeats().find((s) => s.seatNumber.value === '1A')!;
    expect(seat.getStatus()).toBe(SeatStatus.OCCUPIED);

    const events = flight.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(SeatsOccupied);
    expect(events[0]).toMatchObject({
      flightId: 'flight-1',
      holdId: 'hold-1',
      seatNumbers: ['1A'],
    });
  });

  it('throws SeatNotAvailableException when occupying seats that were never held', () => {
    const flight = buildFlight();

    expect(() =>
      flight.occupySeats([SeatNumber.create('1A')], 'hold-1'),
    ).toThrow(SeatNotAvailableException);
    expect(flight.pullDomainEvents()).toHaveLength(0);
  });

  it('pullDomainEvents returns accumulated events and clears them', () => {
    const flight = buildFlight();
    flight.holdSeats([SeatNumber.create('1A')], 'hold-1', soon());
    flight.holdSeats([SeatNumber.create('1B')], 'hold-2', soon());

    const events = flight.pullDomainEvents();

    expect(events).toHaveLength(2);
    expect(flight.pullDomainEvents()).toHaveLength(0);
  });
});
