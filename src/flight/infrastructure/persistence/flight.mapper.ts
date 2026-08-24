import { FlightModel, Prisma } from '@prisma/client';
import { Flight } from '../../domain/models/flight.aggregate';
import { Seat } from '../../domain/models/seat.entity';
import { FlightId } from '../../domain/value-objects/flight-id.vo';
import { FlightNumber } from '../../domain/value-objects/flight-number.vo';
import { Route } from '../../domain/value-objects/route.vo';
import { Schedule } from '../../domain/value-objects/schedule.vo';
import { Capacity } from '../../domain/value-objects/capacity.vo';
import { SeatNumber } from '../../domain/value-objects/seat-number.vo';
import { isSeatClass } from '../../domain/value-objects/seat-class.vo';
import { isSeatStatus } from '../../domain/value-objects/seat-status.vo';

export class FlightMapper {
  static toDomain(raw: FlightModel): Flight {
    const seats = raw.seats.map((rawSeat) => {
      if (!isSeatClass(rawSeat.seatClass)) {
        throw new Error(`Unknown seat class persisted: "${rawSeat.seatClass}"`);
      }
      if (!isSeatStatus(rawSeat.status)) {
        throw new Error(`Unknown seat status persisted: "${rawSeat.status}"`);
      }
      return Seat.reconstitute(
        SeatNumber.create(rawSeat.seatNumber),
        rawSeat.seatClass,
        rawSeat.status,
        rawSeat.holdId ?? null,
        rawSeat.holdExpiresAt ?? null,
      );
    });

    return Flight.reconstitute(
      FlightId.create(raw.domainId),
      FlightNumber.create(raw.flightNumber),
      Route.create(raw.originAirport, raw.destAirport),
      Schedule.create(raw.departureTime, raw.arrivalTime),
      Capacity.create({
        ECONOMY: raw.economyCapacity,
        BUSINESS: raw.businessCapacity,
        FIRST: raw.firstCapacity,
      }),
      seats,
    );
  }

  static toPersistence(flight: Flight): Prisma.FlightModelCreateInput {
    const route = flight.getRoute();
    const schedule = flight.getSchedule();
    const capacity = flight.getCapacity();

    return {
      domainId: flight.getId().value,
      flightNumber: flight.getFlightNumber().toString(),
      originAirport: route.origin,
      destAirport: route.destination,
      departureTime: schedule.departureTime,
      arrivalTime: schedule.arrivalTime,
      economyCapacity: capacity.forSeatClass('ECONOMY'),
      businessCapacity: capacity.forSeatClass('BUSINESS'),
      firstCapacity: capacity.forSeatClass('FIRST'),
      seats: flight.getSeats().map((seat) => ({
        seatNumber: seat.seatNumber.value,
        seatClass: seat.seatClass,
        status: seat.getStatus(),
        holdId: seat.getHoldId(),
        holdExpiresAt: seat.getHoldExpiry(),
      })),
    };
  }
}
