import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PAYMENT_GATEWAY_PORT } from './application/ports/payment-gateway.port';
import { MockPaymentAdapter } from './infrastructure/adapters/mock-payment.adapter';
import { CreateReservationHandler } from './application/commands/create-reservation/create-reservation.handler';
import { ConfirmReservationHandler } from './application/commands/confirm-reservation/confirm-reservation.handler';
import { CancelReservationHandler } from './application/commands/cancel-reservation/cancel-reservation.handler';

@Module({
  imports: [CqrsModule],
  providers: [
    {
      provide: PAYMENT_GATEWAY_PORT,
      useClass: MockPaymentAdapter,
    },
    CreateReservationHandler,
    ConfirmReservationHandler,
    CancelReservationHandler,
  ],
  exports: [
    PAYMENT_GATEWAY_PORT,
    CreateReservationHandler,
    ConfirmReservationHandler,
    CancelReservationHandler,
  ],
})
export class ReservationModule {}
