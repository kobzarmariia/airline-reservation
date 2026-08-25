import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateReservationHandler } from './create-reservation.handler';
import {
  CreateReservationCommand,
  CreateReservationSeatAssignmentInput,
} from './create-reservation.command';
import { ReservationRepositoryPort } from '../../../domain/repositories/reservation.repository.interface';
import { Reservation } from '../../../domain/models/reservation.aggregate';
import { ReservationId } from '../../../domain/value-objects/reservation-id.vo';
import { RESERVATION_HOLD_DURATION_MINUTES } from '../../../domain/policies/reservation-hold.policy';
import { SeatPriceNotFoundException } from '../../exceptions/seat-price-not-found.exception';
import { GetFlightSeatMapQuery } from '../../../../flight/application/queries/get-flight-seat-map/get-flight-seat-map.query';
import { FlightSeatMapDto } from '../../../../flight/application/queries/get-flight-seat-map/flight-seat-map.dto';

class InMemoryReservationRepository implements ReservationRepositoryPort {
  private readonly reservationsById = new Map<string, Reservation>();
  readonly save = jest.fn((reservation: Reservation): Promise<void> => {
    this.reservationsById.set(reservation.getId().value, reservation);
    return Promise.resolve();
  });

  findById(id: ReservationId): Promise<Reservation | null> {
    return Promise.resolve(this.reservationsById.get(id.value) ?? null);
  }

  findByHoldId(): Promise<Reservation | null> {
    return Promise.resolve(null);
  }

  findExpiredPending(): Promise<Reservation[]> {
    return Promise.resolve([]);
  }
}

function buildCommand(
  overrides: Partial<{
    flightId: string;
    holdId: string;
    seatAssignments: CreateReservationSeatAssignmentInput[];
  }> = {},
): CreateReservationCommand {
  return new CreateReservationCommand({
    flightId: 'flight-1',
    holdId: 'hold-1',
    seatAssignments: [
      {
        seatNumber: '1A',
        passenger: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
        },
      },
    ],
    ...overrides,
  });
}

function buildSeatMap(
  seats: Array<{ seatNumber: string; price: number }>,
): FlightSeatMapDto {
  return {
    flightId: 'flight-1',
    flightNumber: 'LH1234',
    origin: 'FRA',
    destination: 'JFK',
    departureTime: new Date().toISOString(),
    seats: seats.map((seat) => ({
      seatNumber: seat.seatNumber,
      status: 'HELD',
      cabinClass: 'ECONOMY',
      price: seat.price,
    })),
    totalSeats: seats.length,
    availableSeats: 0,
    heldSeats: seats.length,
    occupiedSeats: 0,
  } as FlightSeatMapDto;
}

describe('CreateReservationHandler', () => {
  let reservationRepository: InMemoryReservationRepository;
  let queryBus: { execute: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let handler: CreateReservationHandler;

  beforeEach(() => {
    reservationRepository = new InMemoryReservationRepository();
    queryBus = {
      execute: jest.fn((query: unknown) => {
        if (query instanceof GetFlightSeatMapQuery) {
          return Promise.resolve(
            buildSeatMap([{ seatNumber: '1A', price: 150 }]),
          );
        }
        return Promise.resolve(undefined);
      }),
    };
    eventEmitter = { emit: jest.fn() };
    handler = new CreateReservationHandler(
      reservationRepository,
      queryBus as never,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('resolves prices from the Flight module for the pre-existing hold, persists a PENDING reservation, and dispatches ReservationCreated', async () => {
    const command = buildCommand();

    const beforeCall = Date.now();
    const result = await handler.execute(command);
    const afterCall = Date.now();

    expect(queryBus.execute).toHaveBeenCalledTimes(1);
    const seatMapQuery = queryBus.execute.mock
      .calls[0][0] as GetFlightSeatMapQuery;
    expect(seatMapQuery).toBeInstanceOf(GetFlightSeatMapQuery);
    expect(seatMapQuery.flightId).toBe('flight-1');

    expect(reservationRepository.save).toHaveBeenCalledTimes(1);
    const savedReservation = reservationRepository.save.mock.calls[0][0];
    expect(savedReservation.getStatus()).toBe('PENDING');
    expect(savedReservation.getHoldId()).toBe('hold-1');

    expect(result.reservationId).toEqual(expect.any(String));
    expect(result.status).toBe('PENDING');
    // The seat's authoritative price (150.00) resolved from the Flight
    // module is converted to Money's integer minor units (cents).
    expect(result.totalPrice.amount).toBe(15000);
    expect(result.totalPrice.currency).toBe('USD');

    // The handler computes its own hold-expiry window (mirroring the
    // Flight module's), since the seat map projection intentionally omits
    // raw hold-expiry timestamps.
    const expectedDurationMs = RESERVATION_HOLD_DURATION_MINUTES * 60 * 1000;
    expect(result.holdExpiresAt.getTime()).toBeGreaterThanOrEqual(
      beforeCall + expectedDurationMs,
    );
    expect(result.holdExpiresAt.getTime()).toBeLessThanOrEqual(
      afterCall + expectedDurationMs,
    );

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    const [eventName] = eventEmitter.emit.mock.calls[0] as [string];
    expect(eventName).toBe('ReservationCreated');
  });

  it('throws SeatPriceNotFoundException and does not persist or dispatch when the Flight module has no price for a requested seat', async () => {
    queryBus.execute.mockImplementationOnce(() =>
      Promise.resolve(buildSeatMap([{ seatNumber: '2B', price: 150 }])),
    );
    const command = buildCommand();

    await expect(handler.execute(command)).rejects.toThrow(
      SeatPriceNotFoundException,
    );

    expect(reservationRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates domain invariant violations without persisting or dispatching', async () => {
    const command = buildCommand({ seatAssignments: [] });

    await expect(handler.execute(command)).rejects.toThrow();

    expect(reservationRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates repository save failures without dispatching', async () => {
    reservationRepository.save.mockImplementationOnce(() => {
      throw new Error('database unavailable');
    });
    const command = buildCommand();

    await expect(handler.execute(command)).rejects.toThrow(
      'database unavailable',
    );

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
