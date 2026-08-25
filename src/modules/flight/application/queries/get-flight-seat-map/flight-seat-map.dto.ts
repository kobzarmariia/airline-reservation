import { ApiProperty } from '@nestjs/swagger';
import { SeatStatus } from '../../../domain/value-objects/seat-status.vo';

export class FlightSeatMapSeatDto {
  @ApiProperty({ description: 'Seat number, e.g. "12A".', example: '12A' })
  readonly seatNumber: string;

  @ApiProperty({
    description:
      'Real-time seat status. A seat persisted as HELD whose hold has expired is projected as AVAILABLE.',
    enum: SeatStatus,
    example: SeatStatus.AVAILABLE,
  })
  readonly status: SeatStatus;

  @ApiProperty({ description: 'Cabin class of the seat.', example: 'ECONOMY' })
  readonly cabinClass: string;

  @ApiProperty({ description: 'Price of the seat.', example: 249 })
  readonly price: number;

  constructor(props: {
    seatNumber: string;
    status: SeatStatus;
    cabinClass: string;
    price: number;
  }) {
    this.seatNumber = props.seatNumber;
    this.status = props.status;
    this.cabinClass = props.cabinClass;
    this.price = props.price;
  }
}

export class FlightSeatMapDto {
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
    description: 'Seat map for the flight.',
    type: [FlightSeatMapSeatDto],
  })
  readonly seats: FlightSeatMapSeatDto[];

  @ApiProperty({
    description: 'Total number of seats on the flight.',
    example: 180,
  })
  readonly totalSeats: number;

  @ApiProperty({
    description: 'Number of seats currently available.',
    example: 120,
  })
  readonly availableSeats: number;

  @ApiProperty({ description: 'Number of seats currently held.', example: 20 })
  readonly heldSeats: number;

  @ApiProperty({
    description: 'Number of seats currently occupied.',
    example: 40,
  })
  readonly occupiedSeats: number;

  constructor(props: {
    flightId: string;
    flightNumber: string;
    origin: string;
    destination: string;
    departureTime: string;
    seats: FlightSeatMapSeatDto[];
    totalSeats: number;
    availableSeats: number;
    heldSeats: number;
    occupiedSeats: number;
  }) {
    this.flightId = props.flightId;
    this.flightNumber = props.flightNumber;
    this.origin = props.origin;
    this.destination = props.destination;
    this.departureTime = props.departureTime;
    this.seats = props.seats;
    this.totalSeats = props.totalSeats;
    this.availableSeats = props.availableSeats;
    this.heldSeats = props.heldSeats;
    this.occupiedSeats = props.occupiedSeats;
  }
}
