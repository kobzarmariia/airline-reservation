import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ConfirmSeatsCommand } from '../../../flight/application/commands/confirm-seats/confirm-seats.command';
import { ReleaseSeatsCommand } from '../../../flight/application/commands/release-seats/release-seats.command';
import { GetFlightSeatMapQuery } from '../../../flight/application/queries/get-flight-seat-map/get-flight-seat-map.query';
import type { FlightSeatMapDto } from '../../../flight/application/queries/get-flight-seat-map/flight-seat-map.dto';
import {
  FlightInventoryPort,
  FlightSeatPrice,
} from '../../application/ports/flight-inventory.port';
import { SeatPriceNotFoundException } from '../../application/exceptions/seat-price-not-found.exception';
import { SeatConfirmationUnavailableException } from '../../application/exceptions/seat-confirmation-unavailable.exception';

const SEAT_PRICE_CURRENCY = 'USD';
const MINOR_UNITS_PER_UNIT = 100;

// The only class in the Reservation module that talks to the Flight module.
@Injectable()
export class CqrsFlightInventoryAdapter implements FlightInventoryPort {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async getSeatPrices(
    flightId: string,
    seatNumbers: string[],
  ): Promise<FlightSeatPrice[]> {
    const seatMap = await this.queryBus.execute<
      GetFlightSeatMapQuery,
      FlightSeatMapDto
    >(new GetFlightSeatMapQuery(flightId));

    const priceBySeatNumber = new Map(
      seatMap.seats.map((seat) => [seat.seatNumber, seat.price]),
    );

    return seatNumbers.map((seatNumber) => {
      const price = priceBySeatNumber.get(seatNumber);
      if (price === undefined) {
        throw new SeatPriceNotFoundException(flightId, seatNumber);
      }
      return {
        seatNumber,
        amountMinorUnits: Math.round(price * MINOR_UNITS_PER_UNIT),
        currency: SEAT_PRICE_CURRENCY,
      };
    });
  }

  async confirmSeats(flightId: string, holdId: string): Promise<void> {
    try {
      await this.commandBus.execute(
        new ConfirmSeatsCommand({ flightId, holdId }),
      );
    } catch (error) {
      throw new SeatConfirmationUnavailableException(flightId, holdId, error);
    }
  }

  async releaseSeats(flightId: string, holdId: string): Promise<void> {
    await this.commandBus.execute(
      new ReleaseSeatsCommand({ flightId, holdId }),
    );
  }
}
