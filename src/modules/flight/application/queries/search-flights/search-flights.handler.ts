import { Inject, Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { FlightSearchIndexPort } from '../../ports/flight-search-index.port';
import { FLIGHT_SEARCH_INDEX_PORT } from '../../ports/flight-search-index.port';
import { SearchFlightsQuery } from './search-flights.query';
import {
  AirportSummaryDto,
  FlightSearchResultDto,
} from './flight-search-result.dto';

// Queries the Elasticsearch-backed read model (see FlightSearchIndexPort)
// rather than Mongo/Prisma directly: search needs free-text matching across
// airport/city/country/airline names, which the ES index carries and the
// Mongo FlightModel does not.
@QueryHandler(SearchFlightsQuery)
@Injectable()
export class SearchFlightsHandler implements IQueryHandler<
  SearchFlightsQuery,
  FlightSearchResultDto[]
> {
  constructor(
    @Inject(FLIGHT_SEARCH_INDEX_PORT)
    private readonly searchIndex: FlightSearchIndexPort,
  ) {}

  async execute(query: SearchFlightsQuery): Promise<FlightSearchResultDto[]> {
    const documents = await this.searchIndex.search({
      origin: query.origin,
      destination: query.destination,
      departureDate: query.departureDate,
      minAvailableSeats: query.minAvailableSeats,
      searchText: query.searchText,
    });

    return documents.map(
      (document) =>
        new FlightSearchResultDto({
          flightId: document.flightId,
          flightNumber: document.flightNumber,
          airlineName: document.airlineName,
          origin: new AirportSummaryDto(document.origin),
          destination: new AirportSummaryDto(document.destination),
          departureTime: document.departureTime,
          arrivalTime: document.arrivalTime,
          startingPrice: document.startingPrice ?? 0,
          totalAvailableSeats: document.totalAvailableSeats,
        }),
    );
  }
}
