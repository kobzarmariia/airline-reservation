import { Injectable } from '@nestjs/common';
import neo4j from 'neo4j-driver';
import { Neo4jService } from '../../../shared/infrastructure/neo4j/neo4j.service';
import {
  CheapestRoute,
  RouteGraphPort,
  RouteLeg,
} from '../../application/ports/route-graph.port';

const MIN_LAYOVER_MINUTES = 45;

// origin/destination are matched by IATA/city/country case-insensitively
// (see RouteGraphPort), so the condition is shared across every branch
// below rather than a single exact-property match in the MATCH clause.
const AIRPORT_CONDITION = (variable: string, parameter: string) =>
  `(toLower(${variable}.iata) = toLower($${parameter}) OR toLower(${variable}.city) = toLower($${parameter}) OR toLower(${variable}.country) = toLower($${parameter}))`;

const LEG = (flightVar: string, originVar: string, destinationVar: string) =>
  `{flightId: ${flightVar}.flightId, flightNumber: ${flightVar}.flightNumber, departureTime: ${flightVar}.departureTime, arrivalTime: ${flightVar}.arrivalTime, price: ${flightVar}.price, origin: ${originVar}.iata, destination: ${destinationVar}.iata}`;

const DIRECT_BRANCH = `
MATCH (o:Airport)-[:DEPARTURE]->(f1:Flight)-[:ARRIVAL]->(d:Airport)
WHERE ${AIRPORT_CONDITION('o', 'origin')} AND ${AIRPORT_CONDITION('d', 'destination')}
RETURN [${LEG('f1', 'o', 'd')}] AS legs, f1.price AS totalPrice, 0 AS stops`;

const ONE_STOP_BRANCH = `
MATCH (o:Airport)-[:DEPARTURE]->(f1:Flight)-[:ARRIVAL]->(mid:Airport)-[:DEPARTURE]->(f2:Flight)-[:ARRIVAL]->(d:Airport)
WHERE ${AIRPORT_CONDITION('o', 'origin')} AND ${AIRPORT_CONDITION('d', 'destination')}
  AND f2.departureTime >= f1.arrivalTime + duration({minutes: ${MIN_LAYOVER_MINUTES}})
RETURN [${LEG('f1', 'o', 'mid')}, ${LEG('f2', 'mid', 'd')}] AS legs, f1.price + f2.price AS totalPrice, 1 AS stops`;

const TWO_STOP_BRANCH = `
MATCH (o:Airport)-[:DEPARTURE]->(f1:Flight)-[:ARRIVAL]->(mid1:Airport)-[:DEPARTURE]->(f2:Flight)-[:ARRIVAL]->(mid2:Airport)-[:DEPARTURE]->(f3:Flight)-[:ARRIVAL]->(d:Airport)
WHERE ${AIRPORT_CONDITION('o', 'origin')} AND ${AIRPORT_CONDITION('d', 'destination')}
  AND f2.departureTime >= f1.arrivalTime + duration({minutes: ${MIN_LAYOVER_MINUTES}})
  AND f3.departureTime >= f2.arrivalTime + duration({minutes: ${MIN_LAYOVER_MINUTES}})
RETURN [${LEG('f1', 'o', 'mid1')}, ${LEG('f2', 'mid1', 'mid2')}, ${LEG('f3', 'mid2', 'd')}] AS legs, f1.price + f2.price + f3.price AS totalPrice, 2 AS stops`;

const BRANCHES_BY_MAX_STOPS = [
  [DIRECT_BRANCH],
  [DIRECT_BRANCH, ONE_STOP_BRANCH],
  [DIRECT_BRANCH, ONE_STOP_BRANCH, TWO_STOP_BRANCH],
];

function toNumber(value: unknown): number {
  return neo4j.isInt(value) ? value.toNumber() : (value as number);
}

function toJsDate(value: unknown): Date {
  return neo4j.isDateTime(value) ? value.toStandardDate() : (value as Date);
}

@Injectable()
export class Neo4jRouteGraphAdapter implements RouteGraphPort {
  constructor(private readonly neo4j: Neo4jService) {}

  async findCheapestRoute(
    origin: string,
    destination: string,
    maxStops: number,
  ): Promise<CheapestRoute | null> {
    const clampedMaxStops = Math.min(Math.max(Math.trunc(maxStops), 0), 2);
    const branches = BRANCHES_BY_MAX_STOPS[clampedMaxStops];
    // ORDER BY/LIMIT after a bare UNION ALL binds only to the last branch,
    // not the combined result (a Cypher gotcha) — wrapping the branches in
    // a CALL subquery makes the final ORDER BY/LIMIT apply across all of
    // them, so the cheapest route is picked regardless of its stop count.
    const query = `CALL {\n${branches.join('\nUNION ALL\n')}\n}\nRETURN legs, totalPrice, stops\nORDER BY totalPrice ASC\nLIMIT 1`;

    const session = this.neo4j.getSession();
    try {
      const result = await session.run(query, { origin, destination });
      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const legs = (record.get('legs') as Array<Record<string, unknown>>).map(
        (leg): RouteLeg => ({
          flightId: leg.flightId as string,
          flightNumber: leg.flightNumber as string,
          origin: leg.origin as string,
          destination: leg.destination as string,
          departureTime: toJsDate(leg.departureTime),
          arrivalTime: toJsDate(leg.arrivalTime),
          price: toNumber(leg.price),
        }),
      );

      return {
        legs,
        totalPrice: toNumber(record.get('totalPrice')),
        stops: toNumber(record.get('stops')),
      };
    } finally {
      await session.close();
    }
  }
}
