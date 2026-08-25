import { ApiProperty } from '@nestjs/swagger';

export class FlightSearchResultDto {
  @ApiProperty({ description: 'Identifier of the flight.' })
  readonly flightId: string;

  @ApiProperty({ description: 'Flight number.', example: 'AA1234' })
  readonly flightNumber: string;

  @ApiProperty({ description: 'Origin airport (IATA code).', example: 'JFK' })
  readonly origin: string;

  @ApiProperty({
    description: 'Destination airport (IATA code).',
    example: 'LAX',
  })
  readonly destination: string;

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
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    startingPrice: number;
    totalAvailableSeats: number;
  }) {
    this.flightId = props.flightId;
    this.flightNumber = props.flightNumber;
    this.origin = props.origin;
    this.destination = props.destination;
    this.departureTime = props.departureTime;
    this.arrivalTime = props.arrivalTime;
    this.startingPrice = props.startingPrice;
    this.totalAvailableSeats = props.totalAvailableSeats;
  }
}
