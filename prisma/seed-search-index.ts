import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import type { FlightSearchDocument } from '../src/modules/flight/application/ports/flight-search-index.port';
import {
  FLIGHT_SEARCH_INDEX,
  FLIGHT_SEARCH_INDEX_MAPPING,
} from '../src/modules/flight/infrastructure/search/flight-search-index.schema';
import { SeatStatus } from '../src/modules/flight/domain/value-objects/seat-status.vo';
import { projectSeatStatus } from '../src/modules/flight/application/queries/shared/project-seat-status';
import {
  OpenFlightsAirport,
  parseAirlines,
  parseAirports,
} from './openflights/parse-openflights';

// Rebuilds the Elasticsearch flight search read model from whatever is
// currently in Mongo. Mongo/Prisma (seeded by `prisma/seed.ts`, `npm run
// db:seed`) is the system of record for the Flight aggregate; this script
// is the independent projection step — it can be re-run on its own, at any
// time, without touching Mongo, which is the point of keeping the search
// index as a derived CQRS read model rather than seeding it inline.
const prisma = new PrismaClient();
const elasticsearch = new ElasticsearchClient({
  node: process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200',
});

const OPENFLIGHTS_DATA_DIR = join(__dirname, '..', 'data', 'openflights');
const AIRPORTS = parseAirports(join(OPENFLIGHTS_DATA_DIR, 'airports.dat'));
const AIRLINES = parseAirlines(join(OPENFLIGHTS_DATA_DIR, 'airlines.dat'));

// Flights don't store the airline IATA code directly, but FlightNumber's
// own format (see flight-number.vo.ts) guarantees it's the number's
// two-letter prefix.
function airlineIataFromFlightNumber(flightNumber: string): string {
  return flightNumber.slice(0, 2);
}

function airportSummary(iata: string): OpenFlightsAirport {
  return AIRPORTS.get(iata) ?? { iata, name: iata, city: '', country: '' };
}

function airlineName(iata: string): string {
  return AIRLINES.get(iata)?.name ?? iata;
}

async function rebuildIndex(): Promise<void> {
  const exists = await elasticsearch.indices.exists({
    index: FLIGHT_SEARCH_INDEX,
  });
  if (exists) {
    await elasticsearch.indices.delete({ index: FLIGHT_SEARCH_INDEX });
  }
  await elasticsearch.indices.create({
    index: FLIGHT_SEARCH_INDEX,
    mappings: FLIGHT_SEARCH_INDEX_MAPPING,
  });
}

async function main(): Promise<void> {
  console.log('Rebuilding the Elasticsearch flight search index...');
  await rebuildIndex();

  const flights = await prisma.flightModel.findMany();
  console.log(`Indexing ${flights.length} flights from Mongo...`);

  const now = new Date();
  const documents: FlightSearchDocument[] = flights.map((flight) => {
    let totalAvailableSeats = 0;
    let startingPrice: number | null = null;
    for (const seat of flight.seats) {
      if (projectSeatStatus(seat, now) !== SeatStatus.AVAILABLE) {
        continue;
      }
      totalAvailableSeats++;
      if (startingPrice === null || seat.price < startingPrice) {
        startingPrice = seat.price;
      }
    }

    return {
      flightId: flight.domainId,
      flightNumber: flight.flightNumber,
      airlineName: airlineName(
        airlineIataFromFlightNumber(flight.flightNumber),
      ),
      origin: airportSummary(flight.originAirport),
      destination: airportSummary(flight.destAirport),
      departureTime: flight.departureTime.toISOString(),
      arrivalTime: flight.arrivalTime.toISOString(),
      totalAvailableSeats,
      startingPrice,
    };
  });

  if (documents.length > 0) {
    await elasticsearch.bulk({
      operations: documents.flatMap((document) => [
        { index: { _index: FLIGHT_SEARCH_INDEX, _id: document.flightId } },
        document,
      ]),
      refresh: true,
    });
  }

  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await elasticsearch.close();
  });
