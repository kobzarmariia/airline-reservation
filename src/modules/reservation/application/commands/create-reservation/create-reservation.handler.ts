import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RESERVATION_REPOSITORY_PORT } from '../../../domain/repositories/reservation.repository.interface';
import type { ReservationRepositoryPort } from '../../../domain/repositories/reservation.repository.interface';
import { Reservation } from '../../../domain/models/reservation.aggregate';
import { SeatAssignment } from '../../../domain/value-objects/seat-assignment.vo';
import { PassengerInfo } from '../../../domain/value-objects/passenger-info.vo';
import { Money } from '../../../domain/value-objects/money.vo';
import { ReservationHoldPolicy } from '../../../domain/policies/reservation-hold.policy';
import { GetFlightSeatMapQuery } from '../../../../flight/application/queries/get-flight-seat-map/get-flight-seat-map.query';
import type { FlightSeatMapDto } from '../../../../flight/application/queries/get-flight-seat-map/flight-seat-map.dto';
import { SeatPriceNotFoundException } from '../../exceptions/seat-price-not-found.exception';
import { CreateReservationCommand } from './create-reservation.command';
import { CreateReservationResult } from './create-reservation.result';

// The Flight module is the sole source of truth for ticket pricing and
// currently prices every seat in this single currency — there is no
// per-flight or per-seat currency to read yet, so it's fixed here rather
// than accepted from the client.
const SEAT_PRICE_CURRENCY = 'USD';

@CommandHandler(CreateReservationCommand)
@Injectable()
export class CreateReservationHandler implements ICommandHandler<
  CreateReservationCommand,
  CreateReservationResult
> {
  constructor(
    @Inject(RESERVATION_REPOSITORY_PORT)
    private readonly reservationRepository: ReservationRepositoryPort,
    private readonly queryBus: QueryBus,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // The seat hold itself already exists in the Flight module by the time
  // this command runs (a prior, separate step in the booking flow) — this
  // handler only prices and persists the Reservation for that existing
  // holdId, so there's no HoldSeatsCommand to dispatch and no seat release
  // to compensate with on failure.
  async execute(
    command: CreateReservationCommand,
  ): Promise<CreateReservationResult> {
    const seatNumbers = command.seatAssignments.map((a) => a.seatNumber);
    const priceBySeatNumber = await this.resolveSeatPrices(
      command.flightId,
      seatNumbers,
    );

    const seatAssignments = command.seatAssignments.map((assignment) =>
      SeatAssignment.create(
        assignment.seatNumber,
        PassengerInfo.create(assignment.passenger),
        priceBySeatNumber.get(assignment.seatNumber)!,
      ),
    );

    const now = new Date();
    const reservation = Reservation.create({
      flightId: command.flightId,
      holdId: command.holdId,
      seatAssignments,
      holdExpiresAt: ReservationHoldPolicy.resolveExpiresAt(now),
      now,
    });

    await this.reservationRepository.save(reservation);

    for (const event of reservation.pullDomainEvents()) {
      this.eventEmitter.emit(event.constructor.name, event);
    }

    return {
      reservationId: reservation.getId().value,
      status: reservation.getStatus(),
      totalPrice: reservation.getTotalPrice(),
      holdExpiresAt: reservation.getHoldExpiresAt(),
    };
  }

  // Resolves authoritative seat prices from the Flight module rather than
  // trusting client-supplied amounts, converting its whole-currency-unit
  // prices into the integer minor units Money requires.
  private async resolveSeatPrices(
    flightId: string,
    seatNumbers: string[],
  ): Promise<Map<string, Money>> {
    const seatMap = await this.queryBus.execute<
      GetFlightSeatMapQuery,
      FlightSeatMapDto
    >(new GetFlightSeatMapQuery(flightId));

    const priceBySeatNumber = new Map<string, number>(
      seatMap.seats.map((seat) => [seat.seatNumber, seat.price]),
    );

    const result = new Map<string, Money>();
    for (const seatNumber of seatNumbers) {
      const price = priceBySeatNumber.get(seatNumber);
      if (price === undefined) {
        throw new SeatPriceNotFoundException(flightId, seatNumber);
      }
      result.set(
        seatNumber,
        Money.create(Math.round(price * 100), SEAT_PRICE_CURRENCY),
      );
    }
    return result;
  }
}
