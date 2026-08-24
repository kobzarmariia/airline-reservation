import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class HoldSeatsDto {
  @ApiProperty({
    description: 'Seat numbers to hold on the flight.',
    example: ['12A', '12B'],
    type: [String],
  })
  @IsArray({ message: 'seatNumbers must be an array of seat numbers.' })
  @ArrayNotEmpty({
    message: 'seatNumbers must contain at least one seat number.',
  })
  @ArrayUnique({
    message: 'seatNumbers must not contain duplicate seat numbers.',
  })
  @IsString({ each: true, message: 'Each seat number must be a string.' })
  @MinLength(2, {
    each: true,
    message: 'Each seat number must be at least 2 characters long.',
  })
  readonly seatNumbers!: string[];

  @ApiProperty({
    description: 'Client-generated UUID identifying this hold request.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'holdId must be a valid UUID.' })
  readonly holdId!: string;
}
