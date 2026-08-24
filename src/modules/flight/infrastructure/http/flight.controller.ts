import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { HoldSeatsCommand } from '../../application/commands/hold-seats/hold-seats.command';
import { HoldSeatsResult } from '../../application/commands/hold-seats/hold-seats.result';
import { HoldSeatsDto } from './dto/hold-seats.dto';
import { HoldSeatsResponseDto } from './dto/hold-seats-response.dto';

@Controller('flights')
export class FlightController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':flightId/holds')
  @HttpCode(HttpStatus.CREATED)
  async holdSeats(
    @Param('flightId') flightId: string,
    @Body() dto: HoldSeatsDto,
  ): Promise<HoldSeatsResponseDto> {
    const result = await this.commandBus.execute<
      HoldSeatsCommand,
      HoldSeatsResult
    >(
      new HoldSeatsCommand({
        flightId,
        seatNumbers: dto.seatNumbers,
        holdId: dto.holdId,
      }),
    );

    return new HoldSeatsResponseDto({
      holdId: dto.holdId,
      flightId,
      seatNumbers: dto.seatNumbers,
      expiresAt: result.expiresAt.toISOString(),
    });
  }
}
