import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { FlightRepositoryPort } from '../../domain/repositories/flight.repository.interface';
import { Flight } from '../../domain/models/flight.aggregate';
import { FlightId } from '../../domain/value-objects/flight-id.vo';
import { FlightNumber } from '../../domain/value-objects/flight-number.vo';
import { SeatStatus } from '../../domain/value-objects/seat-status.vo';
import { ConcurrencyConflictException } from '../../domain/exceptions/concurrency-conflict.exception';
import { FlightMapper } from './flight.mapper';

@Injectable()
export class PrismaFlightRepository implements FlightRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(flight: Flight): Promise<void> {
    const data = FlightMapper.toPersistence(flight);
    const currentVersion = flight.getVersion();

    const existing = await this.prisma.flightModel.findUnique({
      where: { domainId: flight.getId().value },
      select: { domainId: true },
    });

    if (!existing) {
      await this.prisma.flightModel.create({
        data: { ...data, version: currentVersion },
      });
      return;
    }

    // Optimistic concurrency control: only apply the write if the version
    // in the database still matches the one this aggregate was loaded with.
    // A concurrent writer that already bumped the version makes this match
    // zero documents, signaling a lost-update race rather than silently
    // overwriting the other writer's changes.
    const result = await this.prisma.flightModel.updateMany({
      where: { domainId: flight.getId().value, version: currentVersion },
      data: { ...data, version: currentVersion + 1 },
    });

    if (result.count === 0) {
      throw new ConcurrencyConflictException(flight.getId().value);
    }

    flight.incrementVersion();
  }

  async findById(id: FlightId): Promise<Flight | null> {
    const raw = await this.prisma.flightModel.findUnique({
      where: { domainId: id.value },
    });
    return raw ? FlightMapper.toDomain(raw) : null;
  }

  async findByFlightNumberAndDate(
    flightNumber: FlightNumber,
    departureDate: Date,
  ): Promise<Flight | null> {
    const startOfDay = new Date(departureDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const raw = await this.prisma.flightModel.findFirst({
      where: {
        flightNumber: flightNumber.toString(),
        departureTime: { gte: startOfDay, lt: endOfDay },
      },
    });

    return raw ? FlightMapper.toDomain(raw) : null;
  }

  async findFlightsWithExpiredHolds(now: Date): Promise<Flight[]> {
    const rawFlights = await this.prisma.flightModel.findMany({
      where: {
        seats: {
          some: {
            status: SeatStatus.HELD,
            holdExpiresAt: { lt: now },
          },
        },
      },
    });

    return rawFlights.map((raw) => FlightMapper.toDomain(raw));
  }
}
