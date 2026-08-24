import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FLIGHT_REPOSITORY_PORT } from '../../../domain/repositories/flight.repository.interface';
import type { FlightRepositoryPort } from '../../../domain/repositories/flight.repository.interface';
import { FlightId } from '../../../domain/value-objects/flight-id.vo';
import { SeatNumber } from '../../../domain/value-objects/seat-number.vo';
import { FlightNotFoundException } from '../../../domain/exceptions/flight-not-found.exception';
import { HoldSeatsCommand } from './hold-seats.command';
import { HoldSeatsResult } from './hold-seats.result';

@CommandHandler(HoldSeatsCommand)
@Injectable()
export class HoldSeatsHandler
  implements ICommandHandler<HoldSeatsCommand, HoldSeatsResult>
{
  constructor(
    @Inject(FLIGHT_REPOSITORY_PORT)
    private readonly flightRepository: FlightRepositoryPort,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: HoldSeatsCommand): Promise<HoldSeatsResult> {
    const flightId = FlightId.create(command.flightId);
    const flight = await this.flightRepository.findById(flightId);
    if (!flight) {
      throw new FlightNotFoundException(command.flightId);
    }

    const seatNumbers = command.seatNumbers.map((seatNumber) =>
      SeatNumber.create(seatNumber),
    );
    const expiresAt = flight.holdSeats(seatNumbers, command.holdId, new Date());

    await this.flightRepository.save(flight);

    for (const event of flight.pullDomainEvents()) {
      this.eventEmitter.emit(event.constructor.name, event);
    }

    return { expiresAt };
  }
}
