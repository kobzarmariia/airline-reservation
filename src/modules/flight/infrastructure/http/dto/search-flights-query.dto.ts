import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SearchFlightsQueryDto {
  @ApiPropertyOptional({
    description: 'IATA code of the departure airport.',
    example: 'JFK',
  })
  @IsOptional()
  @IsString({ message: 'origin must be a string.' })
  readonly origin?: string;

  @ApiPropertyOptional({
    description: 'IATA code of the arrival airport.',
    example: 'LAX',
  })
  @IsOptional()
  @IsString({ message: 'destination must be a string.' })
  readonly destination?: string;

  @ApiPropertyOptional({
    description:
      'Departure date. Matches any flight departing on this UTC calendar day.',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'date must be a valid ISO 8601 date string.' })
  readonly date?: string;

  @ApiPropertyOptional({
    description: 'Only return flights with at least this many available seats.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'minSeats must be an integer.' })
  @Min(0, { message: 'minSeats must not be negative.' })
  readonly minSeats?: number;
}
