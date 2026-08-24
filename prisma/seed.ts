import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { Flight } from '../src/flight/domain/models/flight.aggregate';
import { Seat } from '../src/flight/domain/models/seat.entity';
import { FlightId } from '../src/flight/domain/value-objects/flight-id.vo';
import { FlightNumber } from '../src/flight/domain/value-objects/flight-number.vo';
import { Route } from '../src/flight/domain/value-objects/route.vo';
import { Schedule } from '../src/flight/domain/value-objects/schedule.vo';
import {
  Capacity,
  CapacityBySeatClass,
} from '../src/flight/domain/value-objects/capacity.vo';
import { SeatNumber } from '../src/flight/domain/value-objects/seat-number.vo';
import { SeatClass } from '../src/flight/domain/value-objects/seat-class.vo';
import { SeatStatus } from '../src/flight/domain/value-objects/seat-status.vo';
import { FlightMapper } from '../src/flight/infrastructure/persistence/flight.mapper';

const prisma = new PrismaClient();

const FLIGHT_COUNT = 30;

const AIRLINES = [
  'AA', 'DL', 'UA', 'BA', 'LH', 'AF', 'EK', 'QR', 'SQ', 'JL',
  'NH', 'KL', 'LX', 'IB', 'TK', 'CX', 'QF', 'LA', 'AC', 'VS',
];

const AIRPORTS = [
  'JFK', 'LAX', 'ORD', 'ATL', 'DFW', 'DEN', 'SFO', 'SEA', 'MIA', 'BOS',
  'LHR', 'CDG', 'FRA', 'AMS', 'MAD', 'FCO', 'DXB', 'DOH', 'SIN', 'HND',
  'NRT', 'ICN', 'SYD', 'GRU', 'YYZ', 'ZRH', 'MUC', 'BCN', 'IST', 'HKG',
];

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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function randomRoute(): { origin: string; destination: string } {
  const origin = pick(AIRPORTS);
  let destination = pick(AIRPORTS);
  while (destination === origin) {
    destination = pick(AIRPORTS);
  }
  return { origin, destination };
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

function buildFlight(): Flight {
  const flightNumber = FlightNumber.create(
    `${pick(AIRLINES)}${randomInt(100, 9999)}`,
  );
  const { origin, destination } = randomRoute();
  const { departureTime, arrivalTime } = randomSchedule();
  const capacityBySeatClass = pick(AIRCRAFT_PROFILES);

  return Flight.reconstitute(
    FlightId.generate(),
    flightNumber,
    Route.create(origin, destination),
    Schedule.create(departureTime, arrivalTime),
    Capacity.create(capacityBySeatClass),
    buildSeats(capacityBySeatClass),
  );
}

async function main(): Promise<void> {
  console.log('Clearing existing flights...');
  await prisma.flightModel.deleteMany();

  console.log(`Seeding ${FLIGHT_COUNT} flights...`);
  for (let i = 0; i < FLIGHT_COUNT; i++) {
    const flight = buildFlight();
    const data = FlightMapper.toPersistence(flight);
    await prisma.flightModel.create({ data });
    console.log(
      `  [${i + 1}/${FLIGHT_COUNT}] ${data.flightNumber} ${data.originAirport}->${data.destAirport} @ ${(data.departureTime as Date).toISOString()}`,
    );
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
  });
