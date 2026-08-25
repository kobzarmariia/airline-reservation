import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { FlightModule } from './modules/flight/flight.module';
import { ReservationModule } from './modules/reservation/reservation.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    FlightModule,
    ReservationModule,
  ],
})
export class AppModule {}
