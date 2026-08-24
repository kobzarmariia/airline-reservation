import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { FlightRepositoryPort } from '../../domain/repositories/flight.repository.interface';
import { Flight } from '../../domain/models/flight.aggregate';
import { FlightId } from '../../domain/value-objects/flight-id.vo';
import { FlightNumber } from '../../domain/value-objects/flight-number.vo';
import { FlightMapper } from './flight.mapper';

@Injectable()
export class PrismaFlightRepository implements FlightRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(flight: Flight): Promise<void> {
    const data = FlightMapper.toPersistence(flight);

    await this.prisma.flightModel.upsert({
      where: { domainId: flight.getId().value },
      create: data,
      update: data,
    });
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
}
