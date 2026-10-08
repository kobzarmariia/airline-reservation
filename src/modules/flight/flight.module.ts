import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';
import { ElasticsearchModule } from '../shared/infrastructure/elasticsearch/elasticsearch.module';
import { Neo4jModule } from '../shared/infrastructure/neo4j/neo4j.module';
import { FLIGHT_REPOSITORY_PORT } from './domain/repositories/flight.repository.interface';
import { PrismaFlightRepository } from './infrastructure/persistence/prisma-flight.repository';
import { FLIGHT_SEARCH_INDEX_PORT } from './application/ports/flight-search-index.port';
import { ElasticsearchFlightSearchAdapter } from './infrastructure/search/elasticsearch-flight-search.adapter';
import { SyncSearchIndexListener } from './infrastructure/search/sync-search-index.listener';
import { ROUTE_GRAPH_PORT } from './application/ports/route-graph.port';
import { Neo4jRouteGraphAdapter } from './infrastructure/graph/neo4j-route-graph.adapter';
import { HoldSeatsHandler } from './application/commands/hold-seats/hold-seats.handler';
import { ConfirmSeatsHandler } from './application/commands/confirm-seats/confirm-seats.handler';
import { ReleaseSeatsHandler } from './application/commands/release-seats/release-seats.handler';
import { GetFlightSeatMapHandler } from './application/queries/get-flight-seat-map/get-flight-seat-map.handler';
import { SearchFlightsHandler } from './application/queries/search-flights/search-flights.handler';
import { FindCheapestRouteHandler } from './application/queries/find-cheapest-route/find-cheapest-route.handler';
import { FlightController } from './infrastructure/http/flight.controller';
import { FlightDomainExceptionFilter } from './infrastructure/http/filters/flight-domain-exception.filter';
import { ExpireSeatHoldsWorker } from './infrastructure/jobs/expire-seat-holds.worker';

@Module({
  imports: [
    PrismaModule,
    ElasticsearchModule,
    Neo4jModule,
    CqrsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [FlightController],
  providers: [
    {
      provide: FLIGHT_REPOSITORY_PORT,
      useClass: PrismaFlightRepository,
    },
    {
      provide: FLIGHT_SEARCH_INDEX_PORT,
      useClass: ElasticsearchFlightSearchAdapter,
    },
    {
      provide: ROUTE_GRAPH_PORT,
      useClass: Neo4jRouteGraphAdapter,
    },
    HoldSeatsHandler,
    ConfirmSeatsHandler,
    ReleaseSeatsHandler,
    GetFlightSeatMapHandler,
    SearchFlightsHandler,
    FindCheapestRouteHandler,
    SyncSearchIndexListener,
    ExpireSeatHoldsWorker,
    // Scoped to this module's own domain exceptions only (see @Catch(...) in
    // the filter), so binding it via APP_FILTER is safe even though the
    // token applies globally — it never touches exceptions from other modules.
    {
      provide: APP_FILTER,
      useClass: FlightDomainExceptionFilter,
    },
  ],
  exports: [
    FLIGHT_REPOSITORY_PORT,
    HoldSeatsHandler,
    ConfirmSeatsHandler,
    ReleaseSeatsHandler,
    GetFlightSeatMapHandler,
    SearchFlightsHandler,
    FindCheapestRouteHandler,
  ],
})
export class FlightModule {}
