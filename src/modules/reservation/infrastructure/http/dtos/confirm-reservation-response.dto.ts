import { ApiProperty } from '@nestjs/swagger';

export class ConfirmReservationResponseDto {
  @ApiProperty({
    description: 'Identifier of the confirmed reservation.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  readonly reservationId: string;

  @ApiProperty({
    description: 'Status of the reservation.',
    example: 'CONFIRMED',
  })
  readonly status: string;

  @ApiProperty({
    description: 'Identifier of the successful payment.',
    example: 'pay_mock_3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  readonly paymentId: string;

  constructor(props: {
    reservationId: string;
    status: string;
    paymentId: string;
  }) {
    this.reservationId = props.reservationId;
    this.status = props.status;
    this.paymentId = props.paymentId;
  }
}
