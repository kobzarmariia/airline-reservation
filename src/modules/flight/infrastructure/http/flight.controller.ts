import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { HoldSeatsCommand } from '../../application/commands/hold-seats/hold-seats.command';
import { HoldSeatsResult } from '../../application/commands/hold-seats/hold-seats.result';
import { ConfirmSeatsCommand } from '../../application/commands/confirm-seats/confirm-seats.command';
import { ConfirmSeatsResult } from '../../application/commands/confirm-seats/confirm-seats.result';
import { ReleaseSeatsCommand } from '../../application/commands/release-seats/release-seats.command';
import { GetFlightSeatMapQuery } from '../../application/queries/get-flight-seat-map/get-flight-seat-map.query';
import { FlightSeatMapDto } from '../../application/queries/get-flight-seat-map/flight-seat-map.dto';
import { SearchFlightsQuery } from '../../application/queries/search-flights/search-flights.query';
import { FlightSearchResultDto } from '../../application/queries/search-flights/flight-search-result.dto';
import { HoldSeatsDto } from './dto/hold-seats.dto';
import { HoldSeatsResponseDto } from './dto/hold-seats-response.dto';
import { ConfirmSeatsResponseDto } from './dto/confirm-seats-response.dto';
import { SearchFlightsQueryDto } from './dto/search-flights-query.dto';

@ApiTags('flights')
@Controller('flights')
export class FlightController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search flights by route, departure date, and seat availability.',
  })
  @ApiOkResponse({
    description: 'Flights matching the search criteria.',
    type: [FlightSearchResultDto],
  })
  async searchFlights(
    @Query() dto: SearchFlightsQueryDto,
  ): Promise<FlightSearchResultDto[]> {
    return this.queryBus.execute<SearchFlightsQuery, FlightSearchResultDto[]>(
      new SearchFlightsQuery({
        origin: dto.origin,
        destination: dto.destination,
        departureDate: dto.date ? new Date(dto.date) : undefined,
        minAvailableSeats: dto.minSeats,
      }),
    );
  }

  @Get(':flightId/seats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the real-time seat map for a flight.' })
  @ApiParam({
    name: 'flightId',
    description: 'Identifier of the flight to get the seat map for.',
  })
  @ApiOkResponse({
    description: 'The flight seat map.',
    type: FlightSeatMapDto,
  })
  async getSeatMap(
    @Param('flightId') flightId: string,
  ): Promise<FlightSeatMapDto> {
    return this.queryBus.execute<GetFlightSeatMapQuery, FlightSeatMapDto>(
      new GetFlightSeatMapQuery(flightId),
    );
  }

  @Post(':flightId/holds')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Temporarily hold seats on a flight.' })
  @ApiParam({
    name: 'flightId',
    description: 'Identifier of the flight to hold seats on.',
  })
  @ApiCreatedResponse({
    description: 'The seats were successfully held.',
    type: HoldSeatsResponseDto,
  })
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

  @Post(':flightId/holds/:holdId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm a seat hold, converting held seats into occupied seats.',
  })
  @ApiParam({
    name: 'flightId',
    description: 'Identifier of the flight the hold belongs to.',
  })
  @ApiParam({
    name: 'holdId',
    description: 'UUID of the hold to confirm.',
  })
  @ApiOkResponse({
    description: 'The hold was successfully confirmed.',
    type: ConfirmSeatsResponseDto,
  })
  async confirmSeats(
    @Param('flightId') flightId: string,
    @Param('holdId') holdId: string,
  ): Promise<ConfirmSeatsResponseDto> {
    const result = await this.commandBus.execute<
      ConfirmSeatsCommand,
      ConfirmSeatsResult
    >(new ConfirmSeatsCommand({ flightId, holdId }));

    return new ConfirmSeatsResponseDto({
      holdId,
      flightId,
      seatNumbers: [...result.seatNumbers],
    });
  }

  @Delete(':flightId/holds/:holdId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Release a seat hold, freeing its seats.' })
  @ApiParam({
    name: 'flightId',
    description: 'Identifier of the flight the hold belongs to.',
  })
  @ApiParam({
    name: 'holdId',
    description: 'UUID of the hold to release.',
  })
  @ApiNoContentResponse({
    description:
      'The hold was released. Idempotent: also returned if the hold no longer exists.',
  })
  async releaseSeats(
    @Param('flightId') flightId: string,
    @Param('holdId') holdId: string,
  ): Promise<void> {
    await this.commandBus.execute<ReleaseSeatsCommand, void>(
      new ReleaseSeatsCommand({ flightId, holdId }),
    );
  }
}
