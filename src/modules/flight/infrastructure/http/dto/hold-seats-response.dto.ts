import { ApiProperty } from '@nestjs/swagger';

export class HoldSeatsResponseDto {
  @ApiProperty({
    description: 'Client-generated UUID identifying this hold request.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  readonly holdId: string;

  @ApiProperty({
    description: 'Identifier of the flight the seats were held on.',
    example: 'FL123',
  })
  readonly flightId: string;

  @ApiProperty({
    description: 'Seat numbers that were held.',
    example: ['12A', '12B'],
    type: [String],
  })
  readonly seatNumbers: string[];

  @ApiProperty({
    description: 'ISO 8601 timestamp when the hold expires.',
    example: '2026-08-24T12:30:00.000Z',
  })
  readonly expiresAt: string;

  constructor(props: {
    holdId: string;
    flightId: string;
    seatNumbers: string[];
    expiresAt: string;
  }) {
    this.holdId = props.holdId;
    this.flightId = props.flightId;
    this.seatNumbers = props.seatNumbers;
    this.expiresAt = props.expiresAt;
  }
}
