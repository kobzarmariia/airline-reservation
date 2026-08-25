import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';
import { RESERVATION_REPOSITORY_PORT } from './domain/repositories/reservation.repository.interface';
import { PrismaReservationRepository } from './infrastructure/repositories/prisma-reservation.repository';
import { PAYMENT_GATEWAY_PORT } from './application/ports/payment-gateway.port';
import { MockPaymentAdapter } from './infrastructure/adapters/mock-payment.adapter';
import { CreateReservationHandler } from './application/commands/create-reservation/create-reservation.handler';
import { ConfirmReservationHandler } from './application/commands/confirm-reservation/confirm-reservation.handler';
import { CancelReservationHandler } from './application/commands/cancel-reservation/cancel-reservation.handler';
import { ReservationController } from './infrastructure/http/controllers/reservation.controller';
import { ReservationExceptionFilter } from './infrastructure/http/filters/reservation-exception.filter';

@Module({
  imports: [PrismaModule, CqrsModule],
  controllers: [ReservationController],
  providers: [
    {
      provide: RESERVATION_REPOSITORY_PORT,
      useClass: PrismaReservationRepository,
    },
    {
      provide: PAYMENT_GATEWAY_PORT,
      useClass: MockPaymentAdapter,
    },
    CreateReservationHandler,
    ConfirmReservationHandler,
    CancelReservationHandler,
    // Scoped to this module's own domain/application exceptions only (see
    // @Catch(...) in the filter), so binding it via APP_FILTER is safe even
    // though the token applies globally — it never touches exceptions from
    // other modules.
    {
      provide: APP_FILTER,
      useClass: ReservationExceptionFilter,
    },
  ],
  exports: [
    RESERVATION_REPOSITORY_PORT,
    PAYMENT_GATEWAY_PORT,
    CreateReservationHandler,
    ConfirmReservationHandler,
    CancelReservationHandler,
  ],
})
export class ReservationModule {}
