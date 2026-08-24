import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FlightModule } from './modules/flight/flight.module';

@Module({
  imports: [EventEmitterModule.forRoot(), FlightModule],
})
export class AppModule {}
