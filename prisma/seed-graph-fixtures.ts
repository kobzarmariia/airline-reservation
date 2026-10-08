import { PrismaClient } from '@prisma/client';
import { Flight } from '../src/modules/flight/domain/models/flight.aggregate';
import { Seat } from '../src/modules/flight/domain/models/seat.entity';
import { FlightId } from '../src/modules/flight/domain/value-objects/flight-id.vo';
import { FlightNumber } from '../src/modules/flight/domain/value-objects/flight-number.vo';
import { Route } from '../src/modules/flight/domain/value-objects/route.vo';
import { Schedule } from '../src/modules/flight/domain/value-objects/schedule.vo';
import { Capacity } from '../src/modules/flight/domain/value-objects/capacity.vo';
import { SeatNumber } from '../src/modules/flight/domain/value-objects/seat-number.vo';
import { SeatStatus } from '../src/modules/flight/domain/value-objects/seat-status.vo';
import { FlightMapper } from '../src/modules/flight/infrastructure/persistence/flight.mapper';

const prisma = new PrismaClient();

// A small, deterministic network for practicing Neo4j pathfinding (see
// prisma/seed-neo4j.ts, which projects these same flights into the graph).
// Unlike prisma/seed.ts's 5000 random flights, these are hand-picked so
// multiple real, time-feasible connections exist between JFK and LGA, which
// OpenFlights both tag with city "New York" (unlike BUR, tagged "Burbank",
// not "Los Angeles" — a deliberate negative case for city-level search).
// Layovers are always >=60min, and prices are chosen so the cheapest route
// isn't the obvious direct flight. All seats are left AVAILABLE: there's
// nothing here for ExpireSeatHoldsWorker to do.
interface FixtureFlight {
  readonly flightNumber: string;
  readonly origin: string;
  readonly destination: string;
  readonly departure: string; // "HH:MM", same demo day for every flight
  readonly arrival: string;
  readonly price: number;
}

const FIXTURE_FLIGHTS: FixtureFlight[] = [
  {
    flightNumber: 'AA101',
    origin: 'JFK',
    destination: 'LAX',
    departure: '08:00',
    arrival: '11:30',
    price: 480,
  },
  {
    flightNumber: 'AA201',
    origin: 'JFK',
    destination: 'ORD',
    departure: '07:00',
    arrival: '09:00',
    price: 140,
  },
  {
    flightNumber: 'AA202',
    origin: 'ORD',
    destination: 'LAX',
    departure: '10:30',
    arrival: '13:00',
    price: 190,
  },
  {
    flightNumber: 'AA203',
    origin: 'ORD',
    destination: 'BUR',
    departure: '10:30',
    arrival: '12:45',
    price: 185,
  },
  {
    flightNumber: 'DL301',
    origin: 'JFK',
    destination: 'ATL',
    departure: '06:30',
    arrival: '09:00',
    price: 120,
  },
  {
    flightNumber: 'DL302',
    origin: 'ATL',
    destination: 'DFW',
    departure: '10:00',
    arrival: '11:30',
    price: 110,
  },
  {
    flightNumber: 'DL303',
    origin: 'DFW',
    destination: 'LAX',
    departure: '12:30',
    arrival: '14:00',
    price: 150,
  },
  {
    flightNumber: 'UA401',
    origin: 'JFK',
    destination: 'DEN',
    departure: '07:30',
    arrival: '10:00',
    price: 160,
  },
  {
    flightNumber: 'UA402',
    origin: 'DEN',
    destination: 'LAX',
    departure: '11:00',
    arrival: '12:30',
    price: 120,
  },
  {
    flightNumber: 'AS403',
    origin: 'LGA',
    destination: 'DEN',
    departure: '07:15',
    arrival: '09:45',
    price: 130,
  },
];

// A stable namespace so re-running this script upserts the same flights
// instead of creating duplicates, without touching prisma/seed.ts's bulk data.
const DOMAIN_ID_PREFIX = 'graph-fixture-';

function demoDeparture(daysFromNow: number, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  date.setUTCHours(hours, minutes, 0, 0);
  return date;
}

function buildFlight(fixture: FixtureFlight): Flight {
  const departureTime = demoDeparture(7, fixture.departure);
  const arrivalTime = demoDeparture(7, fixture.arrival);

  // One economy cabin, all seats AVAILABLE at the fixture's flat price —
  // seat-level detail doesn't matter for route-graph practice, only that
  // the flight has a valid, bookable-looking shape.
  const seats: Seat[] = [];
  for (const letter of ['A', 'B', 'C', 'D', 'E', 'F']) {
    for (let row = 1; row <= 5; row++) {
      seats.push(
        Seat.reconstitute(
          SeatNumber.create(`${row}${letter}`),
          'ECONOMY',
          fixture.price,
          SeatStatus.AVAILABLE,
          null,
          null,
        ),
      );
    }
  }

  return Flight.reconstitute(
    FlightId.create(`${DOMAIN_ID_PREFIX}${fixture.flightNumber}`),
    FlightNumber.create(fixture.flightNumber),
    Route.create(fixture.origin, fixture.destination),
    Schedule.create(departureTime, arrivalTime),
    Capacity.create({ ECONOMY: seats.length, BUSINESS: 0, FIRST: 0 }),
    seats,
  );
}

async function main(): Promise<void> {
  console.log(`Seeding ${FIXTURE_FLIGHTS.length} graph-fixture flights...`);

  for (const fixture of FIXTURE_FLIGHTS) {
    const flight = buildFlight(fixture);
    const data = FlightMapper.toPersistence(flight);
    await prisma.flightModel.upsert({
      where: { domainId: data.domainId },
      create: data,
      update: data,
    });
    console.log(
      `  ${data.flightNumber} ${data.originAirport}->${data.destAirport} @ ${(data.departureTime as Date).toISOString()} ($${fixture.price})`,
    );
  }

  console.log(
    'Done. Run `npm run graph:seed:neo4j` to project these flights into Neo4j.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
