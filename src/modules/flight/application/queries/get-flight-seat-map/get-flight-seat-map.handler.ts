import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { FlightNotFoundException } from '../../../domain/exceptions/flight-not-found.exception';
import { SeatStatus } from '../../../domain/value-objects/seat-status.vo';
import { projectSeatStatus } from '../shared/project-seat-status';
import { GetFlightSeatMapQuery } from './get-flight-seat-map.query';
import { FlightSeatMapDto, FlightSeatMapSeatDto } from './flight-seat-map.dto';

// Reads straight off the persistence model instead of loading the Flight
// aggregate — the seat map is a display projection, not something that
// needs to go through domain invariants, and skipping the aggregate keeps
// this a single flat read.
@QueryHandler(GetFlightSeatMapQuery)
@Injectable()
export class GetFlightSeatMapHandler implements IQueryHandler<
  GetFlightSeatMapQuery,
  FlightSeatMapDto
> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetFlightSeatMapQuery): Promise<FlightSeatMapDto> {
    const flight = await this.prisma.flightModel.findUnique({
      where: { domainId: query.flightId },
    });
    if (!flight) {
      throw new FlightNotFoundException(query.flightId);
    }

    const now = new Date();
    let availableSeats = 0;
    let heldSeats = 0;
    let occupiedSeats = 0;

    // Sensitive hold details (holdId, raw holdExpiresAt) intentionally stay
    // out of FlightSeatMapSeatDto — this is a general-audience seat map, not
    // an owner-scoped hold view.
    const seats = flight.seats.map((seat) => {
      const status = projectSeatStatus(seat, now);
      if (status === SeatStatus.AVAILABLE) {
        availableSeats++;
      } else if (status === SeatStatus.HELD) {
        heldSeats++;
      } else {
        occupiedSeats++;
      }

      return new FlightSeatMapSeatDto({
        seatNumber: seat.seatNumber,
        status,
        cabinClass: seat.seatClass,
        price: seat.price,
      });
    });

    return new FlightSeatMapDto({
      flightId: flight.domainId,
      flightNumber: flight.flightNumber,
      origin: flight.originAirport,
      destination: flight.destAirport,
      departureTime: flight.departureTime.toISOString(),
      seats,
      totalSeats: seats.length,
      availableSeats,
      heldSeats,
      occupiedSeats,
    });
  }
}
