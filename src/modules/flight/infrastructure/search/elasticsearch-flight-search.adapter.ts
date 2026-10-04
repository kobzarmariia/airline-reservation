import { Injectable, OnModuleInit } from '@nestjs/common';
import type { estypes } from '@elastic/elasticsearch';
import { ElasticsearchService } from '../../../shared/infrastructure/elasticsearch/elasticsearch.service';
import {
  FlightSearchCriteria,
  FlightSearchDocument,
  FlightSearchIndexPort,
} from '../../application/ports/flight-search-index.port';
import {
  FLIGHT_SEARCH_INDEX,
  FLIGHT_SEARCH_INDEX_MAPPING,
} from './flight-search-index.schema';

@Injectable()
export class ElasticsearchFlightSearchAdapter
  implements FlightSearchIndexPort, OnModuleInit
{
  constructor(private readonly client: ElasticsearchService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureIndex();
  }

  async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({
      index: FLIGHT_SEARCH_INDEX,
    });
    if (!exists) {
      await this.client.indices.create({
        index: FLIGHT_SEARCH_INDEX,
        mappings: FLIGHT_SEARCH_INDEX_MAPPING,
      });
    }
  }

  async bulkIndex(documents: FlightSearchDocument[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    const operations = documents.flatMap((document) => [
      { index: { _index: FLIGHT_SEARCH_INDEX, _id: document.flightId } },
      document,
    ]);

    await this.client.bulk({ operations, refresh: true });
  }

  async updateAvailability(
    flightId: string,
    totalAvailableSeats: number,
    startingPrice: number | null,
  ): Promise<void> {
    await this.client.update({
      index: FLIGHT_SEARCH_INDEX,
      id: flightId,
      doc: { totalAvailableSeats, startingPrice },
    });
  }

  async search(
    criteria: FlightSearchCriteria,
  ): Promise<FlightSearchDocument[]> {
    const filter: estypes.QueryDslQueryContainer[] = [];
    if (criteria.origin) {
      filter.push({ term: { 'origin.iata': criteria.origin } });
    }
    if (criteria.destination) {
      filter.push({ term: { 'destination.iata': criteria.destination } });
    }
    if (criteria.departureDate) {
      const startOfDay = new Date(criteria.departureDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
      filter.push({
        range: {
          departureTime: {
            gte: startOfDay.toISOString(),
            lt: endOfDay.toISOString(),
          },
        },
      });
    }
    if (criteria.minAvailableSeats !== undefined) {
      filter.push({
        range: { totalAvailableSeats: { gte: criteria.minAvailableSeats } },
      });
    }

    const must: estypes.QueryDslQueryContainer[] = criteria.searchText
      ? [
          {
            multi_match: {
              query: criteria.searchText,
              fields: [
                'origin.name',
                'origin.city',
                'origin.country',
                'destination.name',
                'destination.city',
                'destination.country',
                'airlineName',
              ],
            },
          },
        ]
      : [];

    const response = await this.client.search<FlightSearchDocument>({
      index: FLIGHT_SEARCH_INDEX,
      query: { bool: { must, filter } },
      sort: [{ departureTime: 'asc' }],
      size: 100,
    });

    return response.hits.hits
      .map((hit) => hit._source)
      .filter((source): source is FlightSearchDocument => source !== undefined);
  }
}
