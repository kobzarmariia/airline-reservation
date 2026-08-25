export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export const RESERVATION_STATUSES = Object.values(
  ReservationStatus,
) as readonly ReservationStatus[];

export function isReservationStatus(
  value: unknown,
): value is ReservationStatus {
  return (
    typeof value === 'string' &&
    Object.values<string>(ReservationStatus).includes(value)
  );
}
