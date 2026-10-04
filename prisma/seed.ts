import { randomUUID } from 'crypto';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { Flight } from '../src/modules/flight/domain/models/flight.aggregate';
import { Seat } from '../src/modules/flight/domain/models/seat.entity';
import { FlightId } from '../src/modules/flight/domain/value-objects/flight-id.vo';
import { FlightNumber } from '../src/modules/flight/domain/value-objects/flight-number.vo';
import { Route } from '../src/modules/flight/domain/value-objects/route.vo';
import { Schedule } from '../src/modules/flight/domain/value-objects/schedule.vo';
import {
  Capacity,
  CapacityBySeatClass,
} from '../src/modules/flight/domain/value-objects/capacity.vo';
import { SeatNumber } from '../src/modules/flight/domain/value-objects/seat-number.vo';
import { SeatClass } from '../src/modules/flight/domain/value-objects/seat-class.vo';
import { SeatStatus } from '../src/modules/flight/domain/value-objects/seat-status.vo';
import { FlightMapper } from '../src/modules/flight/infrastructure/persistence/flight.mapper';
import {
  OpenFlightsRoute,
  parseAirlines,
  parseAirports,
  parseRoutes,
} from './openflights/parse-openflights';

const prisma = new PrismaClient();

const FLIGHT_COUNT = 5000;

const OPENFLIGHTS_DATA_DIR = join(__dirname, '..', 'data', 'openflights');
const AIRPORTS = parseAirports(join(OPENFLIGHTS_DATA_DIR, 'airports.dat'));
const AIRLINES = parseAirlines(join(OPENFLIGHTS_DATA_DIR, 'airlines.dat'));

// FlightNumber only accepts a two-letter airline prefix (see
// flight-number.vo.ts), so routes operated by alphanumeric IATA codes
// (common among low-cost carriers, e.g. "5J", "W6") are excluded here.
const AIRLINE_IATA_PATTERN = /^[A-Z]{2}$/;

const ROUTES: OpenFlightsRoute[] = dedupeRoutes(
  parseRoutes(join(OPENFLIGHTS_DATA_DIR, 'routes.dat')).filter(
    (route) =>
      AIRLINE_IATA_PATTERN.test(route.airlineIata) &&
      AIRLINES.has(route.airlineIata) &&
      AIRPORTS.has(route.originIata) &&
      AIRPORTS.has(route.destinationIata),
  ),
);

function dedupeRoutes(routes: OpenFlightsRoute[]): OpenFlightsRoute[] {
  const seen = new Set<string>();
  const unique: OpenFlightsRoute[] = [];
  for (const route of routes) {
    const key = `${route.airlineIata}-${route.originIata}-${route.destinationIata}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(route);
  }
  return unique;
}

// A handful of representative aircraft cabin layouts, chosen per flight to
// keep the ECONOMY/BUSINESS/FIRST mix realistic (e.g. regional hops rarely
// carry a first-class cabin).
const AIRCRAFT_PROFILES: CapacityBySeatClass[] = [
  { ECONOMY: 76, BUSINESS: 0, FIRST: 0 },
  { ECONOMY: 138, BUSINESS: 12, FIRST: 0 },
  { ECONOMY: 168, BUSINESS: 20, FIRST: 4 },
  { ECONOMY: 220, BUSINESS: 30, FIRST: 8 },
];

const SEAT_LAYOUT_BY_CLASS: { seatClass: SeatClass; letters: string[] }[] = [
  { seatClass: 'FIRST', letters: ['A', 'F'] },
  { seatClass: 'BUSINESS', letters: ['A', 'C', 'D', 'F'] },
  { seatClass: 'ECONOMY', letters: ['A', 'B', 'C', 'D', 'E', 'F'] },
];

const PRICE_RANGE_BY_CLASS: Record<SeatClass, [number, number]> = {
  ECONOMY: [150, 450],
  BUSINESS: [900, 2500],
  FIRST: [3000, 6000],
};

function randomPrice(seatClass: SeatClass): number {
  const [min, max] = PRICE_RANGE_BY_CLASS[seatClass];
  return randomInt(min, max);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function pickRoute(): OpenFlightsRoute {
  return pick(ROUTES);
}

function randomSchedule(): { departureTime: Date; arrivalTime: Date } {
  const daysFromNow = randomInt(1, 60);
  const departureTime = new Date();
  departureTime.setUTCDate(departureTime.getUTCDate() + daysFromNow);
  departureTime.setUTCHours(randomInt(0, 23), pick([0, 15, 30, 45]), 0, 0);

  const durationMinutes = randomInt(60, 14 * 60);
  const arrivalTime = new Date(
    departureTime.getTime() + durationMinutes * 60_000,
  );

  return { departureTime, arrivalTime };
}

function randomSeatStatus(): SeatStatus {
  const roll = Math.random();
  if (roll < 0.6) return SeatStatus.AVAILABLE;
  if (roll < 0.72) return SeatStatus.HELD;
  return SeatStatus.OCCUPIED;
}

function buildSeats(capacity: CapacityBySeatClass): Seat[] {
  const seats: Seat[] = [];
  let row = 1;

  for (const { seatClass, letters } of SEAT_LAYOUT_BY_CLASS) {
    let remaining = capacity[seatClass];
    while (remaining > 0) {
      for (const letter of letters) {
        if (remaining <= 0) break;

        const status = randomSeatStatus();
        const holdId = status === SeatStatus.HELD ? randomUUID() : null;
        const holdExpiresAt =
          status === SeatStatus.HELD
            ? new Date(Date.now() + randomInt(10, 30) * 60_000)
            : null;

        seats.push(
          Seat.reconstitute(
            SeatNumber.create(`${row}${letter}`),
            seatClass,
            randomPrice(seatClass),
            status,
            holdId,
            holdExpiresAt,
          ),
        );
        remaining--;
      }
      row++;
    }
  }

  return seats;
}

function buildFlight(route: OpenFlightsRoute): Flight {
  const flightNumber = FlightNumber.create(
    `${route.airlineIata}${randomInt(100, 9999)}`,
  );
  const { departureTime, arrivalTime } = randomSchedule();
  const capacityBySeatClass = pick(AIRCRAFT_PROFILES);

  return Flight.reconstitute(
    FlightId.generate(),
    flightNumber,
    Route.create(route.originIata, route.destinationIata),
    Schedule.create(departureTime, arrivalTime),
    Capacity.create(capacityBySeatClass),
    buildSeats(capacityBySeatClass),
  );
}

async function main(): Promise<void> {
  console.log(
    `Loaded ${AIRPORTS.size} airports, ${AIRLINES.size} airlines, ${ROUTES.length} usable direct routes from OpenFlights.`,
  );

  console.log('Clearing existing flights...');
  await prisma.flightModel.deleteMany();

  console.log(`Seeding ${FLIGHT_COUNT} flights...`);
  for (let i = 0; i < FLIGHT_COUNT; i++) {
    const route = pickRoute();
    const flight = buildFlight(route);
    const data = FlightMapper.toPersistence(flight);
    await prisma.flightModel.create({ data });
    console.log(
      `  [${i + 1}/${FLIGHT_COUNT}] ${data.flightNumber} ${data.originAirport}->${data.destAirport} @ ${(data.departureTime as Date).toISOString()}`,
    );
  }

  console.log(
    'Done. Run `npm run search:seed` to (re)index the Elasticsearch flight search read model.',
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
