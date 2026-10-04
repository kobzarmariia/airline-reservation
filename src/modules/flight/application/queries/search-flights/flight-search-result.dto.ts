import { ApiProperty } from '@nestjs/swagger';

export class AirportSummaryDto {
  @ApiProperty({ description: 'IATA code of the airport.', example: 'JFK' })
  readonly iata: string;

  @ApiProperty({
    description: 'Airport name.',
    example: 'John F Kennedy International Airport',
  })
  readonly name: string;

  @ApiProperty({ description: 'City the airport serves.', example: 'New York' })
  readonly city: string;

  @ApiProperty({
    description: 'Country the airport is in.',
    example: 'United States',
  })
  readonly country: string;

  constructor(props: {
    iata: string;
    name: string;
    city: string;
    country: string;
  }) {
    this.iata = props.iata;
    this.name = props.name;
    this.city = props.city;
    this.country = props.country;
  }
}

export class FlightSearchResultDto {
  @ApiProperty({ description: 'Identifier of the flight.' })
  readonly flightId: string;

  @ApiProperty({ description: 'Flight number.', example: 'AA1234' })
  readonly flightNumber: string;

  @ApiProperty({
    description: 'Name of the operating airline.',
    example: 'American Airlines',
  })
  readonly airlineName: string;

  @ApiProperty({ description: 'Origin airport.', type: AirportSummaryDto })
  readonly origin: AirportSummaryDto;

  @ApiProperty({ description: 'Destination airport.', type: AirportSummaryDto })
  readonly destination: AirportSummaryDto;

  @ApiProperty({
    description: 'ISO 8601 departure timestamp.',
    example: '2026-09-01T14:30:00.000Z',
  })
  readonly departureTime: string;

  @ApiProperty({
    description: 'ISO 8601 arrival timestamp.',
    example: '2026-09-01T17:45:00.000Z',
  })
  readonly arrivalTime: string;

  @ApiProperty({
    description: 'Lowest price among currently available seats.',
    example: 199,
  })
  readonly startingPrice: number;

  @ApiProperty({
    description: 'Total number of seats currently available on the flight.',
    example: 84,
  })
  readonly totalAvailableSeats: number;

  constructor(props: {
    flightId: string;
    flightNumber: string;
    airlineName: string;
    origin: AirportSummaryDto;
    destination: AirportSummaryDto;
    departureTime: string;
    arrivalTime: string;
    startingPrice: number;
    totalAvailableSeats: number;
  }) {
    this.flightId = props.flightId;
    this.flightNumber = props.flightNumber;
    this.airlineName = props.airlineName;
    this.origin = props.origin;
    this.destination = props.destination;
    this.departureTime = props.departureTime;
    this.arrivalTime = props.arrivalTime;
    this.startingPrice = props.startingPrice;
    this.totalAvailableSeats = props.totalAvailableSeats;
  }
}
