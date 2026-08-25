import { Inject, Injectable } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RESERVATION_REPOSITORY_PORT } from '../../../domain/repositories/reservation.repository.interface';
import type { ReservationRepositoryPort } from '../../../domain/repositories/reservation.repository.interface';
import { ReservationId } from '../../../domain/value-objects/reservation-id.vo';
import { ReservationStatus } from '../../../domain/value-objects/reservation-status.vo';
import { ReservationNotFoundException } from '../../../domain/exceptions/reservation-not-found.exception';
import { ReleaseSeatsCommand } from '../../../../flight/application/commands/release-seats/release-seats.command';
import { CancelReservationCommand } from './cancel-reservation.command';
import { CancelReservationResult } from './cancel-reservation.result';

@CommandHandler(CancelReservationCommand)
@Injectable()
export class CancelReservationHandler implements ICommandHandler<
  CancelReservationCommand,
  CancelReservationResult
> {
  constructor(
    @Inject(RESERVATION_REPOSITORY_PORT)
    private readonly reservationRepository: ReservationRepositoryPort,
    private readonly commandBus: CommandBus,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    command: CancelReservationCommand,
  ): Promise<CancelReservationResult> {
    const reservationId = ReservationId.create(command.reservationId);
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new ReservationNotFoundException(command.reservationId);
    }

    reservation.cancel(command.reason, new Date());

    await this.commandBus.execute(
      new ReleaseSeatsCommand({
        flightId: reservation.getFlightId(),
        holdId: reservation.getHoldId(),
      }),
    );

    await this.reservationRepository.save(reservation);

    for (const event of reservation.pullDomainEvents()) {
      this.eventEmitter.emit(event.constructor.name, event);
    }

    return {
      reservationId: reservation.getId().value,
      status: ReservationStatus.CANCELLED,
    };
  }
}
