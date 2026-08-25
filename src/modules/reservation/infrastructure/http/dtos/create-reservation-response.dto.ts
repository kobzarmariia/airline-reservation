import { ApiProperty } from '@nestjs/swagger';

export class CreateReservationResponseDto {
  @ApiProperty({
    description: 'Identifier of the newly created reservation.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  readonly reservationId: string;

  @ApiProperty({
    description: 'Status of the reservation.',
    example: 'PENDING',
  })
  readonly status: string;

  @ApiProperty({
    description: 'Total price of the reservation, in minor currency units.',
    example: 49800,
  })
  readonly totalPriceAmount: number;

  @ApiProperty({ description: 'Currency of the total price.', example: 'USD' })
  readonly totalPriceCurrency: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the seat hold expires.',
    example: '2026-08-25T12:45:00.000Z',
  })
  readonly holdExpiresAt: string;

  constructor(props: {
    reservationId: string;
    status: string;
    totalPriceAmount: number;
    totalPriceCurrency: string;
    holdExpiresAt: string;
  }) {
    this.reservationId = props.reservationId;
    this.status = props.status;
    this.totalPriceAmount = props.totalPriceAmount;
    this.totalPriceCurrency = props.totalPriceCurrency;
    this.holdExpiresAt = props.holdExpiresAt;
  }
}
