import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelReservationRequestDto {
  @ApiProperty({
    description: 'Reason the reservation is being cancelled.',
    example: 'Customer requested cancellation.',
  })
  @IsString()
  @IsNotEmpty()
  readonly reason!: string;
}
