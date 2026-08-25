import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateReservationCommand } from '../../../application/commands/create-reservation/create-reservation.command';
import { CreateReservationResult } from '../../../application/commands/create-reservation/create-reservation.result';
import { ConfirmReservationCommand } from '../../../application/commands/confirm-reservation/confirm-reservation.command';
import { ConfirmReservationResult } from '../../../application/commands/confirm-reservation/confirm-reservation.result';
import { CancelReservationCommand } from '../../../application/commands/cancel-reservation/cancel-reservation.command';
import { CancelReservationResult } from '../../../application/commands/cancel-reservation/cancel-reservation.result';
import { CreateReservationRequestDto } from '../dtos/create-reservation-request.dto';
import { CreateReservationResponseDto } from '../dtos/create-reservation-response.dto';
import { ConfirmReservationRequestDto } from '../dtos/confirm-reservation-request.dto';
import { ConfirmReservationResponseDto } from '../dtos/confirm-reservation-response.dto';
import { CancelReservationRequestDto } from '../dtos/cancel-reservation-request.dto';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a reservation for an existing seat hold.',
  })
  @ApiCreatedResponse({
    description: 'The reservation was successfully created.',
    type: CreateReservationResponseDto,
  })
  async create(
    @Body() dto: CreateReservationRequestDto,
  ): Promise<CreateReservationResponseDto> {
    const result = await this.commandBus.execute<
      CreateReservationCommand,
      CreateReservationResult
    >(
      new CreateReservationCommand({
        flightId: dto.flightId,
        holdId: dto.holdId,
        seatAssignments: dto.seatAssignments.map((assignment) => ({
          seatNumber: assignment.seatNumber,
          passenger: {
            firstName: assignment.passenger.firstName,
            lastName: assignment.passenger.lastName,
            email: assignment.passenger.email,
            passportNumber: assignment.passenger.passportNumber,
          },
        })),
      }),
    );

    return new CreateReservationResponseDto({
      reservationId: result.reservationId,
      status: result.status,
      totalPriceAmount: result.totalPrice.amount,
      totalPriceCurrency: result.totalPrice.currency,
      holdExpiresAt: result.holdExpiresAt.toISOString(),
    });
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm a reservation by charging payment for it.',
  })
  @ApiParam({ name: 'id', description: 'Identifier of the reservation.' })
  @ApiOkResponse({
    description: 'The reservation was successfully confirmed.',
    type: ConfirmReservationResponseDto,
  })
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmReservationRequestDto,
  ): Promise<ConfirmReservationResponseDto> {
    const result = await this.commandBus.execute<
      ConfirmReservationCommand,
      ConfirmReservationResult
    >(
      new ConfirmReservationCommand({
        reservationId: id,
        paymentMethodToken: dto.paymentMethodToken,
      }),
    );

    return new ConfirmReservationResponseDto({
      reservationId: result.reservationId,
      status: result.status,
      paymentId: result.paymentId,
    });
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a reservation.' })
  @ApiParam({ name: 'id', description: 'Identifier of the reservation.' })
  @ApiNoContentResponse({
    description: 'The reservation was successfully cancelled.',
  })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelReservationRequestDto,
  ): Promise<void> {
    await this.commandBus.execute<
      CancelReservationCommand,
      CancelReservationResult
    >(new CancelReservationCommand({ reservationId: id, reason: dto.reason }));
  }
}
