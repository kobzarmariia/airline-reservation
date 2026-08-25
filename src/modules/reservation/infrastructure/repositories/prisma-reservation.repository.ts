import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ReservationRepositoryPort } from '../../domain/repositories/reservation.repository.interface';
import { Reservation } from '../../domain/models/reservation.aggregate';
import { ReservationId } from '../../domain/value-objects/reservation-id.vo';
import { ReservationStatus } from '../../domain/value-objects/reservation-status.vo';
import { ConcurrencyConflictException } from '../../domain/exceptions/concurrency-conflict.exception';
import { ReservationMapper } from '../mappers/reservation.mapper';

@Injectable()
export class PrismaReservationRepository implements ReservationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(reservation: Reservation): Promise<void> {
    const data = ReservationMapper.toPersistence(reservation);
    const currentVersion = reservation.getVersion();

    const existing = await this.prisma.reservationModel.findUnique({
      where: { domainId: reservation.getId().value },
      select: { domainId: true },
    });

    if (!existing) {
      await this.prisma.reservationModel.create({
        data: { ...data, version: currentVersion },
      });
      return;
    }

    // Optimistic concurrency control: only apply the write if the version
    // in the database still matches the one this aggregate was loaded with.
    // A concurrent writer that already bumped the version makes this match
    // zero documents, signaling a lost-update race rather than silently
    // overwriting the other writer's changes.
    const result = await this.prisma.reservationModel.updateMany({
      where: { domainId: reservation.getId().value, version: currentVersion },
      data: { ...data, version: currentVersion + 1 },
    });

    if (result.count === 0) {
      throw new ConcurrencyConflictException(reservation.getId().value);
    }

    reservation.incrementVersion();
  }

  async findById(id: ReservationId): Promise<Reservation | null> {
    const raw = await this.prisma.reservationModel.findUnique({
      where: { domainId: id.value },
    });
    return raw ? ReservationMapper.toDomain(raw) : null;
  }

  async findByHoldId(holdId: string): Promise<Reservation | null> {
    const raw = await this.prisma.reservationModel.findFirst({
      where: { holdId },
    });
    return raw ? ReservationMapper.toDomain(raw) : null;
  }

  async findExpiredPending(now: Date): Promise<Reservation[]> {
    const rawReservations = await this.prisma.reservationModel.findMany({
      where: {
        status: ReservationStatus.PENDING,
        holdExpiresAt: { lt: now },
      },
    });

    return rawReservations.map((raw) => ReservationMapper.toDomain(raw));
  }
}
