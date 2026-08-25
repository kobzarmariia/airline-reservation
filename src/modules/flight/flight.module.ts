import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';
import { FLIGHT_REPOSITORY_PORT } from './domain/repositories/flight.repository.interface';
import { PrismaFlightRepository } from './infrastructure/persistence/prisma-flight.repository';
import { HoldSeatsHandler } from './application/commands/hold-seats/hold-seats.handler';
import { ConfirmSeatsHandler } from './application/commands/confirm-seats/confirm-seats.handler';
import { ReleaseSeatsHandler } from './application/commands/release-seats/release-seats.handler';
import { GetFlightSeatMapHandler } from './application/queries/get-flight-seat-map/get-flight-seat-map.handler';
import { SearchFlightsHandler } from './application/queries/search-flights/search-flights.handler';
import { FlightController } from './infrastructure/http/flight.controller';
import { FlightDomainExceptionFilter } from './infrastructure/http/filters/flight-domain-exception.filter';
import { ExpireSeatHoldsWorker } from './infrastructure/jobs/expire-seat-holds.worker';

@Module({
  imports: [PrismaModule, CqrsModule, ScheduleModule.forRoot()],
  controllers: [FlightController],
  providers: [
    {
      provide: FLIGHT_REPOSITORY_PORT,
      useClass: PrismaFlightRepository,
    },
    HoldSeatsHandler,
    ConfirmSeatsHandler,
    ReleaseSeatsHandler,
    GetFlightSeatMapHandler,
    SearchFlightsHandler,
    ExpireSeatHoldsWorker,
    // Scoped to this module's own domain exceptions only (see @Catch(...) in
    // the filter), so binding it via APP_FILTER is safe even though the
    // token applies globally — it never touches exceptions from other modules.
    {
      provide: APP_FILTER,
      useClass: FlightDomainExceptionFilter,
    },
  ],
  exports: [
    FLIGHT_REPOSITORY_PORT,
    HoldSeatsHandler,
    ConfirmSeatsHandler,
    ReleaseSeatsHandler,
    GetFlightSeatMapHandler,
    SearchFlightsHandler,
  ],
})
export class FlightModule {}
