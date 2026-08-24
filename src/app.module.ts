import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FlightModule } from './flight/flight.module';

@Module({
  imports: [EventEmitterModule.forRoot(), FlightModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
