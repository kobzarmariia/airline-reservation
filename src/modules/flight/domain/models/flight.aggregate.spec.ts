import { Flight } from './flight.aggregate';
import { it, describe, expect } from '@jest/globals';
import { Seat } from './seat.entity';
import { FlightId } from '../value-objects/flight-id.vo';
import { FlightNumber } from '../value-objects/flight-number.vo';
import { Route } from '../value-objects/route.vo';
import { Schedule } from '../value-objects/schedule.vo';
import { Capacity } from '../value-objects/capacity.vo';
import { SeatNumber } from '../value-objects/seat-number.vo';
import { SeatStatus } from '../value-objects/seat-status.vo';
import { SeatsHeld } from '../events/seats-held.event';
import { SeatsReleased } from '../events/seats-released.event';
import { SeatsConfirmed } from '../events/seats-confirmed.event';
import { FlightAlreadyDepartedException } from '../exceptions/flight-already-departed.exception';
import { SeatNotFoundException } from '../exceptions/seat-not-found.exception';
import { SeatNotAvailableException } from '../exceptions/seat-not-available.exception';
import { HoldNotFoundException } from '../exceptions/hold-not-found.exception';
import { SeatHoldExpiredException } from '../exceptions/seat-hold-expired.exception';
import { SeatHoldPolicy } from '../policies/seat-hold.policy';

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

const now = () => new Date();

describe('Flight', () => {
  it('holds available seats, resolves expiresAt via SeatHoldPolicy, and emits exactly one SeatsHeld event', () => {
    const flight = buildFlight();
    const requestedAt = now();
    const expectedExpiresAt = SeatHoldPolicy.resolveExpiresAt(requestedAt);

    const returnedExpiresAt = flight.holdSeats(
      [SeatNumber.create('1A')],
      'hold-1',
      requestedAt,
    );

    expect(returnedExpiresAt).toEqual(expectedExpiresAt);
    expect(flight.getAvailableSeatCount()).toBe(2);
    const events = flight.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(SeatsHeld);
    expect(events[0]).toMatchObject({
      flightId: 'flight-1',
      holdId: 'hold-1',
      seatNumbers: ['1A'],
      expiresAt: expectedExpiresAt,
    });
  });

  it('throws SeatNotFoundException when holding a seat that does not exist on the flight', () => {
    const flight = buildFlight();

    expect(() =>
      flight.holdSeats([SeatNumber.create('9Z')], 'hold-1', now()),
    ).toThrow(SeatNotFoundException);
    expect(flight.pullDomainEvents()).toHaveLength(0);
  });

  it('throws SeatNotAvailableException when holding an already-held seat', () => {
    const flight = buildFlight();
    flight.holdSeats([SeatNumber.create('1A')], 'hold-1', now());
    flight.pullDomainEvents();

    expect(() =>
      flight.holdSeats([SeatNumber.create('1A')], 'hold-2', now()),
    ).toThrow(SeatNotAvailableException);
  });

  it('throws FlightAlreadyDepartedException when holding seats on a departed flight', () => {
    const flight = buildFlight(new Date(Date.now() - 60 * 60 * 1000));

    expect(() =>
      flight.holdSeats([SeatNumber.create('1A')], 'hold-1', now()),
    ).toThrow(FlightAlreadyDepartedException);
  });

  it('releases all seats held under a holdId, freeing them, and emits SeatsReleased', () => {
    const flight = buildFlight();
    flight.holdSeats(
      [SeatNumber.create('1A'), SeatNumber.create('1B')],
      'hold-1',
      now(),
    );
    flight.pullDomainEvents();

    flight.releaseSeats('hold-1');

    expect(flight.getAvailableSeatCount()).toBe(3);
    const events = flight.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(SeatsReleased);
    expect(events[0]).toMatchObject({
      flightId: 'flight-1',
      holdId: 'hold-1',
      seatNumbers: expect.arrayContaining(['1A', '1B']),
    });
  });

  it('silently succeeds and emits no event when releasing an unknown or already-released holdId', () => {
    const flight = buildFlight();
    flight.holdSeats([SeatNumber.create('1A')], 'hold-1', now());
    flight.pullDomainEvents();

    expect(() => flight.releaseSeats('hold-2')).not.toThrow();

    expect(flight.getAvailableSeatCount()).toBe(2);
    expect(flight.pullDomainEvents()).toHaveLength(0);
  });

  it('confirms held seats, transitioning them from HELD to OCCUPIED, and emits SeatsConfirmed', () => {
    const flight = buildFlight();
    flight.holdSeats([SeatNumber.create('1A')], 'hold-1', now());
    flight.pullDomainEvents();

    flight.confirmSeats('hold-1', now());

    const seat = flight.getSeats().find((s) => s.seatNumber.value === '1A')!;
    expect(seat.getStatus()).toBe(SeatStatus.OCCUPIED);

    const events = flight.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(SeatsConfirmed);
    expect(events[0]).toMatchObject({
      flightId: 'flight-1',
      holdId: 'hold-1',
      seatNumbers: ['1A'],
    });
  });

  it('throws HoldNotFoundException when confirming a holdId that holds no seats', () => {
    const flight = buildFlight();

    expect(() => flight.confirmSeats('hold-1', now())).toThrow(
      HoldNotFoundException,
    );
    expect(flight.pullDomainEvents()).toHaveLength(0);
  });

  it('throws FlightAlreadyDepartedException when confirming seats on a departed flight', () => {
    const flight = buildFlight();
    flight.holdSeats([SeatNumber.create('1A')], 'hold-1', now());
    flight.pullDomainEvents();

    const afterDeparture = new Date(
      flight.getSchedule().departureTime.getTime() + 60 * 1000,
    );

    expect(() => flight.confirmSeats('hold-1', afterDeparture)).toThrow(
      FlightAlreadyDepartedException,
    );
  });

  it('throws SeatHoldExpiredException when confirming a hold past its expiry', () => {
    const flight = buildFlight();
    const requestedAt = now();
    flight.holdSeats([SeatNumber.create('1A')], 'hold-1', requestedAt);
    flight.pullDomainEvents();

    const expiresAt = SeatHoldPolicy.resolveExpiresAt(requestedAt);
    const afterExpiry = new Date(expiresAt.getTime() + 1);

    expect(() => flight.confirmSeats('hold-1', afterExpiry)).toThrow(
      SeatHoldExpiredException,
    );
  });

  it('getExpiredHoldIds returns only holdIds whose hold has passed its expiry, deduplicated', () => {
    const flight = buildFlight();
    const requestedAt = now();
    flight.holdSeats(
      [SeatNumber.create('1A'), SeatNumber.create('1B')],
      'hold-1',
      requestedAt,
    );
    flight.holdSeats([SeatNumber.create('2A')], 'hold-2', requestedAt);
    flight.pullDomainEvents();

    const expiresAt = SeatHoldPolicy.resolveExpiresAt(requestedAt);
    const afterExpiry = new Date(expiresAt.getTime() + 1);

    expect(flight.getExpiredHoldIds(requestedAt)).toHaveLength(0);
    expect(flight.getExpiredHoldIds(afterExpiry).sort()).toEqual([
      'hold-1',
      'hold-2',
    ]);
  });

  it('pullDomainEvents returns accumulated events and clears them', () => {
    const flight = buildFlight();
    flight.holdSeats([SeatNumber.create('1A')], 'hold-1', now());
    flight.holdSeats([SeatNumber.create('1B')], 'hold-2', now());

    const events = flight.pullDomainEvents();

    expect(events).toHaveLength(2);
    expect(flight.pullDomainEvents()).toHaveLength(0);
  });
});
