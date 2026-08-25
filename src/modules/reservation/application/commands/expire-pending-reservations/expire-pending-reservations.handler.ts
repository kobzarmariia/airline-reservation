import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RESERVATION_REPOSITORY_PORT } from '../../../domain/repositories/reservation.repository.interface';
import type { ReservationRepositoryPort } from '../../../domain/repositories/reservation.repository.interface';
import { Reservation } from '../../../domain/models/reservation.aggregate';
import { ReleaseSeatsCommand } from '../../../../flight/application/commands/release-seats/release-seats.command';
import { ExpirePendingReservationsCommand } from './expire-pending-reservations.command';

@CommandHandler(ExpirePendingReservationsCommand)
@Injectable()
export class ExpirePendingReservationsHandler implements ICommandHandler<
  ExpirePendingReservationsCommand,
  number
> {
  private readonly logger = new Logger(ExpirePendingReservationsHandler.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY_PORT)
    private readonly reservationRepository: ReservationRepositoryPort,
    private readonly commandBus: CommandBus,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: ExpirePendingReservationsCommand): Promise<number> {
    const expiredReservations =
      await this.reservationRepository.findExpiredPending(command.now);

    let expiredCount = 0;

    for (const reservation of expiredReservations) {
      try {
        await this.expireReservation(reservation, command.now);
        expiredCount += 1;
      } catch (error) {
        // One failed aggregate (e.g. a concurrency conflict, or a downstream
        // seat-release failure) must not abort the rest of the sweep — log
        // and move on so other expired reservations still get processed.
        this.logger.error(
          `Failed to expire reservation "${reservation.getId().value}".`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return expiredCount;
  }

  private async expireReservation(
    reservation: Reservation,
    now: Date,
  ): Promise<void> {
    reservation.expire(now);

    await this.reservationRepository.save(reservation);

    await this.commandBus.execute(
      new ReleaseSeatsCommand({
        flightId: reservation.getFlightId(),
        holdId: reservation.getHoldId(),
      }),
    );

    for (const event of reservation.pullDomainEvents()) {
      this.eventEmitter.emit(event.constructor.name, event);
    }
  }
}
