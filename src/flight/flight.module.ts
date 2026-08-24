import { Module } from '@nestjs/common';
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';
import { FLIGHT_REPOSITORY_PORT } from './domain/repositories/flight.repository.interface';
import { PrismaFlightRepository } from './infrastructure/persistence/prisma-flight.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: FLIGHT_REPOSITORY_PORT,
      useClass: PrismaFlightRepository,
    },
  ],
  exports: [FLIGHT_REPOSITORY_PORT],
})
export class FlightModule {}
