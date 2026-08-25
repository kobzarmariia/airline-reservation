import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FLIGHT_REPOSITORY_PORT } from '../../../domain/repositories/flight.repository.interface';
import type { FlightRepositoryPort } from '../../../domain/repositories/flight.repository.interface';
import { FlightId } from '../../../domain/value-objects/flight-id.vo';
import { FlightNotFoundException } from '../../../domain/exceptions/flight-not-found.exception';
import { SeatsConfirmed } from '../../../domain/events/seats-confirmed.event';
import { ConfirmSeatsCommand } from './confirm-seats.command';
import { ConfirmSeatsResult } from './confirm-seats.result';

@CommandHandler(ConfirmSeatsCommand)
@Injectable()
export class ConfirmSeatsHandler
  implements ICommandHandler<ConfirmSeatsCommand, ConfirmSeatsResult>
{
  constructor(
    @Inject(FLIGHT_REPOSITORY_PORT)
    private readonly flightRepository: FlightRepositoryPort,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: ConfirmSeatsCommand): Promise<ConfirmSeatsResult> {
    const flightId = FlightId.create(command.flightId);
    const flight = await this.flightRepository.findById(flightId);
    if (!flight) {
      throw new FlightNotFoundException(command.flightId);
    }

    flight.confirmSeats(command.holdId, new Date());

    await this.flightRepository.save(flight);

    const events = flight.pullDomainEvents();
    for (const event of events) {
      this.eventEmitter.emit(event.constructor.name, event);
    }

    const confirmedEvent = events.find(
      (event): event is SeatsConfirmed => event instanceof SeatsConfirmed,
    )!;

    return { seatNumbers: confirmedEvent.seatNumbers };
  }
}
