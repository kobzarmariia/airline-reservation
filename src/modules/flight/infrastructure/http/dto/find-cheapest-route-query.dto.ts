import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class FindCheapestRouteQueryDto {
  @ApiProperty({
    description: 'IATA code, city, or country of the departure airport.',
    example: 'New York',
  })
  @IsString({ message: 'origin must be a string.' })
  @MinLength(1, { message: 'origin must not be empty.' })
  readonly origin: string;

  @ApiProperty({
    description: 'IATA code, city, or country of the arrival airport.',
    example: 'Los Angeles',
  })
  @IsString({ message: 'destination must be a string.' })
  @MinLength(1, { message: 'destination must not be empty.' })
  readonly destination: string;

  @ApiPropertyOptional({
    description: 'Maximum number of intermediate stops (0-2).',
    example: 2,
    default: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'maxStops must be an integer.' })
  @Min(0, { message: 'maxStops must not be negative.' })
  @Max(2, { message: 'maxStops must be at most 2.' })
  readonly maxStops?: number;
}
