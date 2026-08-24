import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class HoldSeatsDto {
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

  @IsUUID('4', { message: 'holdId must be a valid UUID.' })
  readonly holdId!: string;
}
