import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PAYMENT_GATEWAY_PORT } from './application/ports/payment-gateway.port';
import { MockPaymentAdapter } from './infrastructure/adapters/mock-payment.adapter';

@Module({
  imports: [CqrsModule],
  providers: [
    {
      provide: PAYMENT_GATEWAY_PORT,
      useClass: MockPaymentAdapter,
    },
  ],
  exports: [PAYMENT_GATEWAY_PORT],
})
export class ReservationModule {}
