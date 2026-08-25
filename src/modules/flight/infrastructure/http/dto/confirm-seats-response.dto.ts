import { ApiProperty } from '@nestjs/swagger';

export class ConfirmSeatsResponseDto {
  @ApiProperty({
    description: 'UUID of the hold that was confirmed.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  readonly holdId: string;

  @ApiProperty({
    description: 'Identifier of the flight the seats were confirmed on.',
    example: 'FL123',
  })
  readonly flightId: string;

  @ApiProperty({
    description: 'Seat numbers that were confirmed as occupied.',
    example: ['12A', '12B'],
    type: [String],
  })
  readonly seatNumbers: string[];

  constructor(props: {
    holdId: string;
    flightId: string;
    seatNumbers: string[];
  }) {
    this.holdId = props.holdId;
    this.flightId = props.flightId;
    this.seatNumbers = props.seatNumbers;
  }
}
