export const FLIGHT_SEARCH_INDEX = 'flights';

export const FLIGHT_SEARCH_INDEX_MAPPING = {
  properties: {
    flightId: { type: 'keyword' },
    flightNumber: { type: 'keyword' },
    airlineName: { type: 'text' },
    origin: {
      properties: {
        iata: { type: 'keyword' },
        name: { type: 'text' },
        city: { type: 'text' },
        country: { type: 'text' },
      },
    },
    destination: {
      properties: {
        iata: { type: 'keyword' },
        name: { type: 'text' },
        city: { type: 'text' },
        country: { type: 'text' },
      },
    },
    departureTime: { type: 'date' },
    arrivalTime: { type: 'date' },
    totalAvailableSeats: { type: 'integer' },
    startingPrice: { type: 'float' },
  },
} as const;
