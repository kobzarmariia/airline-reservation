import { Module } from '@nestjs/common';
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';
import { FLIGHT_REPOSITORY_PORT } from './domain/repositories/flight.repository.interface';
import { PrismaFlightRepository } from './infrastructure/persistence/prisma-flight.repository';
import { HoldSeatsHandler } from './application/commands/hold-seats/hold-seats.handler';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: FLIGHT_REPOSITORY_PORT,
      useClass: PrismaFlightRepository,
    },
    HoldSeatsHandler,
  ],
  exports: [FLIGHT_REPOSITORY_PORT, HoldSeatsHandler],
})
export class FlightModule {}
