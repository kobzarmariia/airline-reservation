import { Prisma, ReservationModel } from '@prisma/client';
import { Reservation } from '../../domain/models/reservation.aggregate';
import { ReservationId } from '../../domain/value-objects/reservation-id.vo';
import { isReservationStatus } from '../../domain/value-objects/reservation-status.vo';
import { SeatAssignment } from '../../domain/value-objects/seat-assignment.vo';
import { PassengerInfo } from '../../domain/value-objects/passenger-info.vo';
import { Money } from '../../domain/value-objects/money.vo';

export class ReservationMapper {
  static toDomain(raw: ReservationModel): Reservation {
    if (!isReservationStatus(raw.status)) {
      throw new Error(`Unknown reservation status persisted: "${raw.status}"`);
    }

    const seatAssignments = raw.seatAssignments.map((rawAssignment) =>
      SeatAssignment.create(
        rawAssignment.seatNumber,
        PassengerInfo.create({
          firstName: rawAssignment.passenger.firstName,
          lastName: rawAssignment.passenger.lastName,
          email: rawAssignment.passenger.email,
          passportNumber: rawAssignment.passenger.passportNumber,
        }),
        Money.create(rawAssignment.price.amount, rawAssignment.price.currency),
      ),
    );

    return Reservation.reconstitute({
      id: ReservationId.create(raw.domainId),
      flightId: raw.flightId,
      holdId: raw.holdId,
      seatAssignments,
      totalPrice: Money.create(raw.totalPrice.amount, raw.totalPrice.currency),
      status: raw.status,
      holdExpiresAt: raw.holdExpiresAt,
      paymentId: raw.paymentId ?? null,
      cancellationReason: raw.cancellationReason ?? null,
      version: raw.version,
    });
  }

  static toPersistence(
    reservation: Reservation,
  ): Prisma.ReservationModelCreateInput {
    const totalPrice = reservation.getTotalPrice();

    return {
      domainId: reservation.getId().value,
      flightId: reservation.getFlightId(),
      holdId: reservation.getHoldId(),
      status: reservation.getStatus(),
      seatAssignments: reservation.getSeatAssignments().map((assignment) => ({
        seatNumber: assignment.seatNumber,
        passenger: {
          firstName: assignment.passenger.firstName,
          lastName: assignment.passenger.lastName,
          email: assignment.passenger.email,
          passportNumber: assignment.passenger.passportNumber,
        },
        price: {
          amount: assignment.price.amount,
          currency: assignment.price.currency,
        },
      })),
      totalPrice: {
        amount: totalPrice.amount,
        currency: totalPrice.currency,
      },
      holdExpiresAt: reservation.getHoldExpiresAt(),
      paymentId: reservation.getPaymentId(),
      cancellationReason: reservation.getCancellationReason(),
      version: reservation.getVersion(),
    };
  }
}
