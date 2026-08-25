import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FLIGHT_REPOSITORY_PORT } from '../../../domain/repositories/flight.repository.interface';
import type { FlightRepositoryPort } from '../../../domain/repositories/flight.repository.interface';
import { FlightId } from '../../../domain/value-objects/flight-id.vo';
import { FlightNotFoundException } from '../../../domain/exceptions/flight-not-found.exception';
import { ReleaseSeatsCommand } from './release-seats.command';

@CommandHandler(ReleaseSeatsCommand)
@Injectable()
export class ReleaseSeatsHandler
  implements ICommandHandler<ReleaseSeatsCommand, void>
{
  constructor(
    @Inject(FLIGHT_REPOSITORY_PORT)
    private readonly flightRepository: FlightRepositoryPort,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: ReleaseSeatsCommand): Promise<void> {
    const flightId = FlightId.create(command.flightId);
    const flight = await this.flightRepository.findById(flightId);
    if (!flight) {
      throw new FlightNotFoundException(command.flightId);
    }

    flight.releaseSeats(command.holdId);

    await this.flightRepository.save(flight);

    for (const event of flight.pullDomainEvents()) {
      this.eventEmitter.emit(event.constructor.name, event);
    }
  }
}
