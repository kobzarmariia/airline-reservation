import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateSeatAssignmentDto } from './create-seat-assignment.dto';

export class CreateReservationRequestDto {
  @ApiProperty({
    description: 'Identifier of the flight to reserve seats on.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  readonly flightId!: string;

  @ApiProperty({
    description: 'UUID of the existing seat hold in the Flight module.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  readonly holdId!: string;

  @ApiProperty({
    description: 'Seat-to-passenger assignments for this reservation.',
    type: [CreateSeatAssignmentDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateSeatAssignmentDto)
  readonly seatAssignments!: CreateSeatAssignmentDto[];
}
