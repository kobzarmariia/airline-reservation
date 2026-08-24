import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FlightNotFoundException } from '../../../domain/exceptions/flight-not-found.exception';
import { FlightAlreadyDepartedException } from '../../../domain/exceptions/flight-already-departed.exception';
import { SeatNotFoundException } from '../../../domain/exceptions/seat-not-found.exception';
import { SeatNotAvailableException } from '../../../domain/exceptions/seat-not-available.exception';
import { InvalidSeatNumberException } from '../../../domain/exceptions/invalid-seat-number.exception';

type FlightDomainException =
  | FlightNotFoundException
  | FlightAlreadyDepartedException
  | SeatNotFoundException
  | SeatNotAvailableException
  | InvalidSeatNumberException;

// Note: this codebase has no separate "SeatAlreadyHeldException" — a seat
// that is already held is simply not AVAILABLE, so SeatNotAvailableException
// (thrown by Flight.holdSeats) covers that case too.
const STATUS_BY_EXCEPTION = new Map<Function, HttpStatus>([
  [FlightNotFoundException, HttpStatus.NOT_FOUND],
  [SeatNotFoundException, HttpStatus.NOT_FOUND],
  [SeatNotAvailableException, HttpStatus.CONFLICT],
  [FlightAlreadyDepartedException, HttpStatus.CONFLICT],
  [InvalidSeatNumberException, HttpStatus.UNPROCESSABLE_ENTITY],
]);

@Catch(
  FlightNotFoundException,
  FlightAlreadyDepartedException,
  SeatNotFoundException,
  SeatNotAvailableException,
  InvalidSeatNumberException,
)
export class FlightDomainExceptionFilter implements ExceptionFilter {
  catch(exception: FlightDomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      STATUS_BY_EXCEPTION.get(exception.constructor) ??
      HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      error: exception.name,
      message: exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
