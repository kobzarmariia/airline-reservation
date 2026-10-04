import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { FlightRepositoryPort } from '../../domain/repositories/flight.repository.interface';
import { FLIGHT_REPOSITORY_PORT } from '../../domain/repositories/flight.repository.interface';
import { FlightId } from '../../domain/value-objects/flight-id.vo';
import { SeatsHeld } from '../../domain/events/seats-held.event';
import { SeatsReleased } from '../../domain/events/seats-released.event';
import { SeatsConfirmed } from '../../domain/events/seats-confirmed.event';
import type { FlightSearchIndexPort } from '../../application/ports/flight-search-index.port';
import { FLIGHT_SEARCH_INDEX_PORT } from '../../application/ports/flight-search-index.port';

// Keeps the Elasticsearch read model eventually consistent with the Mongo
// system of record: every command that changes seat availability emits a
// domain event, and this listener re-derives the two fields the search index
// cares about (available seat count, starting price) rather than re-indexing
// the whole document.
@Injectable()
export class SyncSearchIndexListener {
  constructor(
    @Inject(FLIGHT_REPOSITORY_PORT)
    private readonly flightRepository: FlightRepositoryPort,
    @Inject(FLIGHT_SEARCH_INDEX_PORT)
    private readonly searchIndex: FlightSearchIndexPort,
  ) {}

  @OnEvent('SeatsHeld')
  async onSeatsHeld(event: SeatsHeld): Promise<void> {
    await this.syncAvailability(event.flightId);
  }

  @OnEvent('SeatsReleased')
  async onSeatsReleased(event: SeatsReleased): Promise<void> {
    await this.syncAvailability(event.flightId);
  }

  @OnEvent('SeatsConfirmed')
  async onSeatsConfirmed(event: SeatsConfirmed): Promise<void> {
    await this.syncAvailability(event.flightId);
  }

  private async syncAvailability(flightId: string): Promise<void> {
    const flight = await this.flightRepository.findById(
      FlightId.create(flightId),
    );
    if (!flight) {
      return;
    }

    let totalAvailableSeats = 0;
    let startingPrice: number | null = null;
    for (const seat of flight.getSeats()) {
      if (!seat.isAvailable()) {
        continue;
      }
      totalAvailableSeats++;
      if (startingPrice === null || seat.price < startingPrice) {
        startingPrice = seat.price;
      }
    }

    await this.searchIndex.updateAvailability(
      flightId,
      totalAvailableSeats,
      startingPrice,
    );
  }
}
