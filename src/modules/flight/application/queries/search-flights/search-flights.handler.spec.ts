import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { SearchFlightsHandler } from './search-flights.handler';
import { SearchFlightsQuery } from './search-flights.query';
import type { FlightSearchIndexPort } from '../../ports/flight-search-index.port';

function document(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    flightId: 'flight-1',
    flightNumber: 'AA1234',
    airlineName: 'American Airlines',
    origin: {
      iata: 'JFK',
      name: 'JFK Airport',
      city: 'New York',
      country: 'US',
    },
    destination: {
      iata: 'LAX',
      name: 'LAX Airport',
      city: 'Los Angeles',
      country: 'US',
    },
    departureTime: '2026-09-01T14:30:00.000Z',
    arrivalTime: '2026-09-01T17:45:00.000Z',
    totalAvailableSeats: 42,
    startingPrice: 199,
    ...overrides,
  };
}

describe('SearchFlightsHandler', () => {
  let searchIndex: { search: jest.Mock };
  let handler: SearchFlightsHandler;

  beforeEach(() => {
    searchIndex = { search: jest.fn() };
    handler = new SearchFlightsHandler(
      searchIndex as unknown as FlightSearchIndexPort,
    );
  });

  it('forwards query criteria to the search index port', async () => {
    searchIndex.search.mockImplementationOnce(() => Promise.resolve([]));
    const departureDate = new Date('2026-09-01T00:00:00.000Z');

    await handler.execute(
      new SearchFlightsQuery({
        origin: 'JFK',
        destination: 'LAX',
        departureDate,
        minAvailableSeats: 2,
        searchText: 'Los Angeles',
      }),
    );

    expect(searchIndex.search).toHaveBeenCalledWith({
      origin: 'JFK',
      destination: 'LAX',
      departureDate,
      minAvailableSeats: 2,
      searchText: 'Los Angeles',
    });
  });

  it('maps indexed documents onto FlightSearchResultDto', async () => {
    searchIndex.search.mockImplementationOnce(() =>
      Promise.resolve([document()]),
    );

    const results = await handler.execute(new SearchFlightsQuery({}));

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      flightId: 'flight-1',
      flightNumber: 'AA1234',
      airlineName: 'American Airlines',
      startingPrice: 199,
      totalAvailableSeats: 42,
    });
    expect(results[0].origin).toMatchObject({ iata: 'JFK', city: 'New York' });
    expect(results[0].destination).toMatchObject({
      iata: 'LAX',
      city: 'Los Angeles',
    });
  });

  it('defaults startingPrice to 0 when the index has no available seat priced', async () => {
    searchIndex.search.mockImplementationOnce(() =>
      Promise.resolve([
        document({ startingPrice: null, totalAvailableSeats: 0 }),
      ]),
    );

    const results = await handler.execute(new SearchFlightsQuery({}));

    expect(results[0].startingPrice).toBe(0);
  });
});
