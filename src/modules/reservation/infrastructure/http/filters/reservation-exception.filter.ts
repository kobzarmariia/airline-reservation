import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ReservationNotFoundException } from '../../../domain/exceptions/reservation-not-found.exception';
import { ReservationExpiredException } from '../../../domain/exceptions/reservation-expired.exception';
import { ReservationAlreadyConfirmedException } from '../../../domain/exceptions/reservation-already-confirmed.exception';
import { InvalidReservationStatusTransitionException } from '../../../domain/exceptions/invalid-reservation-status-transition.exception';
import { InvalidReservationIdException } from '../../../domain/exceptions/invalid-reservation-id.exception';
import { InvalidPassengerAssignmentException } from '../../../domain/exceptions/invalid-passenger-assignment.exception';
import { InvalidSeatAssignmentException } from '../../../domain/exceptions/invalid-seat-assignment.exception';
import { InvalidPassengerInfoException } from '../../../domain/exceptions/invalid-passenger-info.exception';
import { InvalidMoneyException } from '../../../domain/exceptions/invalid-money.exception';
import { ConcurrencyConflictException } from '../../../domain/exceptions/concurrency-conflict.exception';
import { PaymentFailedException } from '../../../application/exceptions/payment-failed.exception';
import { SeatConfirmationFailedException } from '../../../application/exceptions/seat-confirmation-failed.exception';
import { SeatPriceNotFoundException } from '../../../application/exceptions/seat-price-not-found.exception';

type ReservationDomainException =
  | ReservationNotFoundException
  | ReservationExpiredException
  | ReservationAlreadyConfirmedException
  | InvalidReservationStatusTransitionException
  | InvalidReservationIdException
  | InvalidPassengerAssignmentException
  | InvalidSeatAssignmentException
  | InvalidPassengerInfoException
  | InvalidMoneyException
  | ConcurrencyConflictException
  | PaymentFailedException
  | SeatConfirmationFailedException
  | SeatPriceNotFoundException;

const STATUS_BY_EXCEPTION = new Map<Function, HttpStatus>([
  [ReservationNotFoundException, HttpStatus.NOT_FOUND],
  [SeatPriceNotFoundException, HttpStatus.NOT_FOUND],
  [ReservationExpiredException, HttpStatus.CONFLICT],
  [ReservationAlreadyConfirmedException, HttpStatus.CONFLICT],
  [InvalidReservationStatusTransitionException, HttpStatus.CONFLICT],
  [ConcurrencyConflictException, HttpStatus.CONFLICT],
  [InvalidReservationIdException, HttpStatus.UNPROCESSABLE_ENTITY],
  [InvalidPassengerAssignmentException, HttpStatus.UNPROCESSABLE_ENTITY],
  [InvalidSeatAssignmentException, HttpStatus.UNPROCESSABLE_ENTITY],
  [InvalidPassengerInfoException, HttpStatus.UNPROCESSABLE_ENTITY],
  [InvalidMoneyException, HttpStatus.UNPROCESSABLE_ENTITY],
  [PaymentFailedException, HttpStatus.PAYMENT_REQUIRED],
  [SeatConfirmationFailedException, HttpStatus.CONFLICT],
]);

@Catch(
  ReservationNotFoundException,
  ReservationExpiredException,
  ReservationAlreadyConfirmedException,
  InvalidReservationStatusTransitionException,
  InvalidReservationIdException,
  InvalidPassengerAssignmentException,
  InvalidSeatAssignmentException,
  InvalidPassengerInfoException,
  InvalidMoneyException,
  ConcurrencyConflictException,
  PaymentFailedException,
  SeatConfirmationFailedException,
  SeatPriceNotFoundException,
)
export class ReservationExceptionFilter implements ExceptionFilter {
  catch(exception: ReservationDomainException, host: ArgumentsHost): void {
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
