import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PassengerInfoDto {
  @ApiProperty({ description: "Passenger's first name.", example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  readonly firstName!: string;

  @ApiProperty({ description: "Passenger's last name.", example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  readonly lastName!: string;

  @ApiProperty({
    description: "Passenger's email address.",
    example: 'jane.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  readonly email!: string;

  @ApiPropertyOptional({
    description: "Passenger's passport number.",
    example: 'X1234567',
  })
  @IsString()
  @IsOptional()
  readonly passportNumber?: string;
}
