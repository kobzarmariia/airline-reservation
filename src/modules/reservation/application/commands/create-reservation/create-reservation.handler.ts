import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RESERVATION_REPOSITORY_PORT } from '../../../domain/repositories/reservation.repository.interface';
import type { ReservationRepositoryPort } from '../../../domain/repositories/reservation.repository.interface';
import { Reservation } from '../../../domain/models/reservation.aggregate';
import { SeatAssignment } from '../../../domain/value-objects/seat-assignment.vo';
import { PassengerInfo } from '../../../domain/value-objects/passenger-info.vo';
import { Money } from '../../../domain/value-objects/money.vo';
import { ReservationHoldPolicy } from '../../../domain/policies/reservation-hold.policy';
import { FLIGHT_INVENTORY_PORT } from '../../ports/flight-inventory.port';
import type { FlightInventoryPort } from '../../ports/flight-inventory.port';
import { CreateReservationCommand } from './create-reservation.command';
import { CreateReservationResult } from './create-reservation.result';

@CommandHandler(CreateReservationCommand)
@Injectable()
export class CreateReservationHandler implements ICommandHandler<
  CreateReservationCommand,
  CreateReservationResult
> {
  constructor(
    @Inject(RESERVATION_REPOSITORY_PORT)
    private readonly reservationRepository: ReservationRepositoryPort,
    @Inject(FLIGHT_INVENTORY_PORT)
    private readonly flightInventory: FlightInventoryPort,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // The seat hold itself already exists in the Flight module by the time
  // this command runs (a prior, separate step in the booking flow) — this
  // handler only prices and persists the Reservation for that existing
  // holdId, so there's no hold to create and no seat release to compensate
  // with on failure.
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

  // Resolves authoritative seat prices from the Flight context through the
  // Anti-Corruption Layer, which returns them already normalised into the
  // integer minor units Money requires. Throws SeatPriceNotFoundException
  // (from the ACL) if a requested seat has no price.
  private async resolveSeatPrices(
    flightId: string,
    seatNumbers: string[],
  ): Promise<Map<string, Money>> {
    const prices = await this.flightInventory.getSeatPrices(
      flightId,
      seatNumbers,
    );

    return new Map(
      prices.map((price) => [
        price.seatNumber,
        Money.create(price.amountMinorUnits, price.currency),
      ]),
    );
  }
}
