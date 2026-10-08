import { ApiProperty } from '@nestjs/swagger';

export class RouteLegDto {
  @ApiProperty({ description: 'Identifier of the flight.' })
  readonly flightId: string;

  @ApiProperty({ description: 'Flight number.', example: 'UA401' })
  readonly flightNumber: string;

  @ApiProperty({ description: 'IATA code of the leg origin airport.' })
  readonly origin: string;

  @ApiProperty({ description: 'IATA code of the leg destination airport.' })
  readonly destination: string;

  @ApiProperty({ description: 'ISO 8601 departure timestamp.' })
  readonly departureTime: string;

  @ApiProperty({ description: 'ISO 8601 arrival timestamp.' })
  readonly arrivalTime: string;

  @ApiProperty({ description: 'Price of this leg.' })
  readonly price: number;

  constructor(props: {
    flightId: string;
    flightNumber: string;
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    price: number;
  }) {
    this.flightId = props.flightId;
    this.flightNumber = props.flightNumber;
    this.origin = props.origin;
    this.destination = props.destination;
    this.departureTime = props.departureTime;
    this.arrivalTime = props.arrivalTime;
    this.price = props.price;
  }
}

export class CheapestRouteDto {
  @ApiProperty({
    description: 'Legs of the itinerary, in order.',
    type: [RouteLegDto],
  })
  readonly legs: RouteLegDto[];

  @ApiProperty({ description: 'Combined price of all legs.' })
  readonly totalPrice: number;

  @ApiProperty({ description: 'Number of intermediate stops (legs - 1).' })
  readonly stops: number;

  constructor(props: {
    legs: RouteLegDto[];
    totalPrice: number;
    stops: number;
  }) {
    this.legs = props.legs;
    this.totalPrice = props.totalPrice;
    this.stops = props.stops;
  }
}
