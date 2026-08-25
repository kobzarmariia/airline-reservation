import { Inject, Injectable } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RESERVATION_REPOSITORY_PORT } from '../../../domain/repositories/reservation.repository.interface';
import type { ReservationRepositoryPort } from '../../../domain/repositories/reservation.repository.interface';
import { ReservationId } from '../../../domain/value-objects/reservation-id.vo';
import { ReservationStatus } from '../../../domain/value-objects/reservation-status.vo';
import { ReservationNotFoundException } from '../../../domain/exceptions/reservation-not-found.exception';
import { PAYMENT_GATEWAY_PORT } from '../../ports/payment-gateway.port';
import type { PaymentGatewayPort } from '../../ports/payment-gateway.port';
import { PaymentFailedException } from '../../exceptions/payment-failed.exception';
import { ConfirmSeatsCommand } from '../../../../flight/application/commands/confirm-seats/confirm-seats.command';
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
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly commandBus: CommandBus,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    command: ConfirmReservationCommand,
  ): Promise<ConfirmReservationResult> {
    const reservationId = ReservationId.create(command.reservationId);
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new ReservationNotFoundException(command.reservationId);
    }

    const totalPrice = reservation.getTotalPrice();
    const paymentResult = await this.paymentGateway.charge({
      reservationId: reservation.getId().value,
      amount: totalPrice.amount,
      currency: totalPrice.currency,
      paymentMethodToken: command.paymentMethodToken,
    });

    if (!paymentResult.success) {
      throw new PaymentFailedException(paymentResult.failureReason);
    }

    reservation.confirm(paymentResult.paymentId, new Date());

    await this.commandBus.execute(
      new ConfirmSeatsCommand({
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
      status: ReservationStatus.CONFIRMED,
      paymentId: paymentResult.paymentId,
    };
  }
}
