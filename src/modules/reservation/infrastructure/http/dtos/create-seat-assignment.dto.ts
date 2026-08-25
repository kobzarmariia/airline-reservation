import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { PassengerInfoDto } from './passenger-info.dto';

export class CreateSeatAssignmentDto {
  @ApiProperty({ description: 'Seat number to assign.', example: '12A' })
  @IsString()
  @IsNotEmpty()
  readonly seatNumber!: string;

  @ApiProperty({
    description: 'Passenger assigned to this seat.',
    type: PassengerInfoDto,
  })
  @ValidateNested()
  @Type(() => PassengerInfoDto)
  readonly passenger!: PassengerInfoDto;
}
