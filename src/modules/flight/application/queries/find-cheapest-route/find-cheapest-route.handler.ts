import { Inject, Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { RouteGraphPort } from '../../ports/route-graph.port';
import { ROUTE_GRAPH_PORT } from '../../ports/route-graph.port';
import { FindCheapestRouteQuery } from './find-cheapest-route.query';
import { CheapestRouteDto, RouteLegDto } from './cheapest-route.dto';

// Queries the Neo4j-backed route graph read model (see RouteGraphPort)
// rather than Mongo/Prisma directly: finding the cheapest multi-stop
// itinerary is a graph-traversal problem Mongo isn't built for.
@QueryHandler(FindCheapestRouteQuery)
@Injectable()
export class FindCheapestRouteHandler implements IQueryHandler<
  FindCheapestRouteQuery,
  CheapestRouteDto | null
> {
  constructor(
    @Inject(ROUTE_GRAPH_PORT)
    private readonly routeGraph: RouteGraphPort,
  ) {}

  async execute(
    query: FindCheapestRouteQuery,
  ): Promise<CheapestRouteDto | null> {
    const route = await this.routeGraph.findCheapestRoute(
      query.origin,
      query.destination,
      query.maxStops,
    );

    if (!route) {
      return null;
    }

    return new CheapestRouteDto({
      legs: route.legs.map(
        (leg) =>
          new RouteLegDto({
            flightId: leg.flightId,
            flightNumber: leg.flightNumber,
            origin: leg.origin,
            destination: leg.destination,
            departureTime: leg.departureTime.toISOString(),
            arrivalTime: leg.arrivalTime.toISOString(),
            price: leg.price,
          }),
      ),
      totalPrice: route.totalPrice,
      stops: route.stops,
    });
  }
}
