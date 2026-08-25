import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmReservationRequestDto {
  @ApiProperty({
    description: 'Tokenized payment method to charge for this reservation.',
    example: 'tok_visa',
  })
  @IsString()
  @IsNotEmpty()
  readonly paymentMethodToken!: string;
}
