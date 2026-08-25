import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { SeatStatus } from '../../../domain/value-objects/seat-status.vo';
import { projectSeatStatus } from '../shared/project-seat-status';
import { SearchFlightsQuery } from './search-flights.query';
import { FlightSearchResultDto } from './flight-search-result.dto';

// Reads straight off the persistence model instead of loading Flight
// aggregates — search results are lightweight cards, and filtering by
// route/date can be pushed down to the database while availability, which
// depends on real-time hold-expiry projection, is computed per flight.
@QueryHandler(SearchFlightsQuery)
@Injectable()
export class SearchFlightsHandler implements IQueryHandler<
  SearchFlightsQuery,
  FlightSearchResultDto[]
> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: SearchFlightsQuery): Promise<FlightSearchResultDto[]> {
    const where: Prisma.FlightModelWhereInput = {};
    if (query.origin) {
      where.originAirport = query.origin;
    }
    if (query.destination) {
      where.destAirport = query.destination;
    }
    if (query.departureDate) {
      const startOfDay = new Date(query.departureDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
      where.departureTime = { gte: startOfDay, lt: endOfDay };
    }

    const flights = await this.prisma.flightModel.findMany({
      where,
      orderBy: { departureTime: 'asc' },
    });

    const now = new Date();
    const results: FlightSearchResultDto[] = [];

    for (const flight of flights) {
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

      if (
        query.minAvailableSeats !== undefined &&
        totalAvailableSeats < query.minAvailableSeats
      ) {
        continue;
      }

      results.push(
        new FlightSearchResultDto({
          flightId: flight.domainId,
          flightNumber: flight.flightNumber,
          origin: flight.originAirport,
          destination: flight.destAirport,
          departureTime: flight.departureTime.toISOString(),
          arrivalTime: flight.arrivalTime.toISOString(),
          startingPrice: startingPrice ?? 0,
          totalAvailableSeats,
        }),
      );
    }

    return results;
  }
}
