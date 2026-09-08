import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CqrsFlightInventoryAdapter } from './cqrs-flight-inventory.adapter';
import { ConfirmSeatsCommand } from '../../../flight/application/commands/confirm-seats/confirm-seats.command';
import { ReleaseSeatsCommand } from '../../../flight/application/commands/release-seats/release-seats.command';
import { GetFlightSeatMapQuery } from '../../../flight/application/queries/get-flight-seat-map/get-flight-seat-map.query';
import { SeatPriceNotFoundException } from '../../application/exceptions/seat-price-not-found.exception';
import { SeatConfirmationUnavailableException } from '../../application/exceptions/seat-confirmation-unavailable.exception';

function seatMap(seats: Array<{ seatNumber: string; price: number }>) {
  return {
    flightId: 'flight-1',
    flightNumber: 'LH1234',
    origin: 'FRA',
    destination: 'JFK',
    departureTime: new Date().toISOString(),
    seats: seats.map((seat) => ({
      seatNumber: seat.seatNumber,
      status: 'HELD',
      cabinClass: 'ECONOMY',
      price: seat.price,
    })),
    totalSeats: seats.length,
    availableSeats: 0,
    heldSeats: seats.length,
    occupiedSeats: 0,
  };
}

describe('CqrsFlightInventoryAdapter', () => {
  let commandBus: { execute: jest.Mock };
  let queryBus: { execute: jest.Mock };
  let adapter: CqrsFlightInventoryAdapter;

  beforeEach(() => {
    commandBus = { execute: jest.fn(() => Promise.resolve(undefined)) };
    queryBus = { execute: jest.fn() };
    adapter = new CqrsFlightInventoryAdapter(
      commandBus as unknown as CommandBus,
      queryBus as unknown as QueryBus,
    );
  });

  describe('getSeatPrices', () => {
    it('dispatches GetFlightSeatMapQuery and normalises prices to integer minor units', async () => {
      queryBus.execute.mockImplementationOnce(() =>
        Promise.resolve(
          seatMap([
            { seatNumber: '1A', price: 150 },
            { seatNumber: '1B', price: 249.5 },
          ]),
        ),
      );

      const prices = await adapter.getSeatPrices('flight-1', ['1A', '1B']);

      const query = queryBus.execute.mock.calls[0][0] as GetFlightSeatMapQuery;
      expect(query).toBeInstanceOf(GetFlightSeatMapQuery);
      expect(query.flightId).toBe('flight-1');
      expect(prices).toEqual([
        { seatNumber: '1A', amountMinorUnits: 15000, currency: 'USD' },
        { seatNumber: '1B', amountMinorUnits: 24950, currency: 'USD' },
      ]);
    });

    it('throws SeatPriceNotFoundException when the seat map has no price for a requested seat', async () => {
      queryBus.execute.mockImplementationOnce(() =>
        Promise.resolve(seatMap([{ seatNumber: '2B', price: 150 }])),
      );

      await expect(adapter.getSeatPrices('flight-1', ['1A'])).rejects.toThrow(
        SeatPriceNotFoundException,
      );
    });
  });

  describe('confirmSeats', () => {
    it('dispatches ConfirmSeatsCommand', async () => {
      await adapter.confirmSeats('flight-1', 'hold-1');

      const command = commandBus.execute.mock
        .calls[0][0] as ConfirmSeatsCommand;
      expect(command).toBeInstanceOf(ConfirmSeatsCommand);
      expect(command).toMatchObject({ flightId: 'flight-1', holdId: 'hold-1' });
    });

    it('translates any Flight-side failure into SeatConfirmationUnavailableException carrying the cause', async () => {
      const cause = new Error('Hold "hold-1" has expired.');
      commandBus.execute.mockImplementationOnce(() => Promise.reject(cause));

      const error = await adapter
        .confirmSeats('flight-1', 'hold-1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SeatConfirmationUnavailableException);
      expect((error as SeatConfirmationUnavailableException).cause).toBe(cause);
      expect((error as SeatConfirmationUnavailableException).flightId).toBe(
        'flight-1',
      );
      expect((error as SeatConfirmationUnavailableException).holdId).toBe(
        'hold-1',
      );
    });
  });

  describe('releaseSeats', () => {
    it('dispatches ReleaseSeatsCommand', async () => {
      await adapter.releaseSeats('flight-1', 'hold-1');

      const command = commandBus.execute.mock
        .calls[0][0] as ReleaseSeatsCommand;
      expect(command).toBeInstanceOf(ReleaseSeatsCommand);
      expect(command).toMatchObject({ flightId: 'flight-1', holdId: 'hold-1' });
    });
  });
});
