import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import neo4j from 'neo4j-driver';
import { parseAirports } from './openflights/parse-openflights';

// Rebuilds the Neo4j route-graph read model from the graph-fixture flights
// seeded into Mongo by `npm run graph:seed:mongo`. Mongo remains the system
// of record; this script is the independent, rebuildable projection step,
// same idea as prisma/seed-search-index.ts for Elasticsearch — it can be
// re-run on its own, at any time, without touching Mongo.
const prisma = new PrismaClient();
const driver = neo4j.driver(
  process.env.NEO4J_URI ?? 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME ?? 'neo4j',
    process.env.NEO4J_PASSWORD ?? 'password',
  ),
);

const OPENFLIGHTS_DATA_DIR = join(__dirname, '..', 'data', 'openflights');
const AIRPORTS = parseAirports(join(OPENFLIGHTS_DATA_DIR, 'airports.dat'));

// Only the fixture flights from seed-graph-fixtures.ts are projected — not
// prisma/seed.ts's 5000 random flights, whose fully random schedules don't
// form a clean, time-feasible network worth pathfinding over.
const FIXTURE_FLIGHT_NUMBERS = [
  'AA101',
  'AA201',
  'AA202',
  'AA203',
  'DL301',
  'DL302',
  'DL303',
  'UA401',
  'UA402',
  'AS403',
];

function airportProps(iata: string) {
  const airport = AIRPORTS.get(iata);
  return {
    iata,
    name: airport?.name ?? iata,
    city: airport?.city ?? '',
    country: airport?.country ?? '',
  };
}

async function main(): Promise<void> {
  const flights = await prisma.flightModel.findMany({
    where: { flightNumber: { in: FIXTURE_FLIGHT_NUMBERS } },
  });

  if (flights.length === 0) {
    throw new Error(
      'No graph-fixture flights found in Mongo. Run `npm run graph:seed:mongo` first.',
    );
  }

  const session = driver.session();
  try {
    console.log('Wiping existing graph...');
    await session.run('MATCH (n) DETACH DELETE n');

    const airportCodes = new Set<string>();
    for (const flight of flights) {
      airportCodes.add(flight.originAirport);
      airportCodes.add(flight.destAirport);
    }

    console.log(`Creating ${airportCodes.size} airport nodes...`);
    for (const iata of airportCodes) {
      await session.run('CREATE (:Airport $props)', {
        props: airportProps(iata),
      });
    }

    console.log(`Creating ${flights.length} flight nodes and edges...`);
    for (const flight of flights) {
      const startingPrice = flight.seats.reduce(
        (min, seat) => Math.min(min, seat.price),
        Infinity,
      );

      await session.run(
        `MATCH (o:Airport {iata: $origin}), (d:Airport {iata: $destination})
         CREATE (o)-[:DEPARTURE]->(f:Flight {
           flightId: $flightId,
           flightNumber: $flightNumber,
           departureTime: datetime($departureTime),
           arrivalTime: datetime($arrivalTime),
           price: $price
         })-[:ARRIVAL]->(d)`,
        {
          origin: flight.originAirport,
          destination: flight.destAirport,
          flightId: flight.domainId,
          flightNumber: flight.flightNumber,
          departureTime: flight.departureTime.toISOString(),
          arrivalTime: flight.arrivalTime.toISOString(),
          price: startingPrice,
        },
      );
    }

    console.log('Done.');
  } finally {
    await session.close();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await driver.close();
    await prisma.$disconnect();
  });
