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
import {
  FlightInventoryPort,
  FlightSeatPrice,
} from '../../ports/flight-inventory.port';

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

describe('CreateReservationHandler', () => {
  let reservationRepository: InMemoryReservationRepository;
  let flightInventory: {
    getSeatPrices: jest.Mock<
      (flightId: string, seatNumbers: string[]) => Promise<FlightSeatPrice[]>
    >;
    confirmSeats: jest.Mock;
    releaseSeats: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };
  let handler: CreateReservationHandler;

  beforeEach(() => {
    reservationRepository = new InMemoryReservationRepository();
    flightInventory = {
      getSeatPrices: jest.fn((_flightId: string, seatNumbers: string[]) =>
        Promise.resolve(
          seatNumbers.map((seatNumber) => ({
            seatNumber,
            amountMinorUnits: 15000,
            currency: 'USD',
          })),
        ),
      ),
      confirmSeats: jest.fn(() => Promise.resolve()),
      releaseSeats: jest.fn(() => Promise.resolve()),
    };
    eventEmitter = { emit: jest.fn() };
    handler = new CreateReservationHandler(
      reservationRepository,
      flightInventory as unknown as FlightInventoryPort,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('resolves prices from the Flight ACL for the pre-existing hold, persists a PENDING reservation, and dispatches ReservationCreated', async () => {
    const command = buildCommand();

    const beforeCall = Date.now();
    const result = await handler.execute(command);
    const afterCall = Date.now();

    expect(flightInventory.getSeatPrices).toHaveBeenCalledWith('flight-1', [
      '1A',
    ]);

    expect(reservationRepository.save).toHaveBeenCalledTimes(1);
    const savedReservation = reservationRepository.save.mock.calls[0][0];
    expect(savedReservation.getStatus()).toBe('PENDING');
    expect(savedReservation.getHoldId()).toBe('hold-1');

    expect(result.reservationId).toEqual(expect.any(String));
    expect(result.status).toBe('PENDING');
    // The seat's authoritative price, resolved from the Flight context and
    // normalised by the ACL into Money's integer minor units (cents).
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

  it('propagates SeatPriceNotFoundException from the ACL without persisting or dispatching', async () => {
    flightInventory.getSeatPrices.mockRejectedValueOnce(
      new SeatPriceNotFoundException('flight-1', '1A'),
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
