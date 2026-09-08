import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RESERVATION_REPOSITORY_PORT } from '../../../domain/repositories/reservation.repository.interface';
import type { ReservationRepositoryPort } from '../../../domain/repositories/reservation.repository.interface';
import { ReservationId } from '../../../domain/value-objects/reservation-id.vo';
import { ReservationStatus } from '../../../domain/value-objects/reservation-status.vo';
import { ReservationNotFoundException } from '../../../domain/exceptions/reservation-not-found.exception';
import { ConfirmReservationSaga } from '../../sagas/confirm-reservation.saga';
import { ConfirmReservationCommand } from './confirm-reservation.command';
import { ConfirmReservationResult } from './confirm-reservation.result';

@CommandHandler(ConfirmReservationCommand)
@Injectable()
export class ConfirmReservationHandler implements ICommandHandler<
  ConfirmReservationCommand,
  ConfirmReservationResult
> {
  constructor(
    @Inject(RESERVATION_REPOSITORY_PORT)
    private readonly reservationRepository: ReservationRepositoryPort,
    private readonly confirmReservationSaga: ConfirmReservationSaga,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Loads the reservation and delegates the multi-step confirm flow (charge
  // payment, confirm seats, compensate on failure) to ConfirmReservationSaga.
  // The saga transitions the aggregate to CONFIRMED; this handler only
  // persists it and publishes its domain events once the saga succeeds.
  async execute(
    command: ConfirmReservationCommand,
  ): Promise<ConfirmReservationResult> {
    const reservationId = ReservationId.create(command.reservationId);
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new ReservationNotFoundException(command.reservationId);
    }

    const { paymentId } = await this.confirmReservationSaga.run(
      reservation,
      command.paymentMethodToken,
    );

    await this.reservationRepository.save(reservation);

    for (const event of reservation.pullDomainEvents()) {
      this.eventEmitter.emit(event.constructor.name, event);
    }

    return {
      reservationId: reservation.getId().value,
      status: ReservationStatus.CONFIRMED,
      paymentId,
    };
  }
}
