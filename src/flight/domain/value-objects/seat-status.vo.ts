export enum SeatStatus {
  AVAILABLE = 'AVAILABLE',
  HELD = 'HELD',
  OCCUPIED = 'OCCUPIED',
}

export const SEAT_STATUSES = Object.values(SeatStatus) as readonly SeatStatus[];

export function isSeatStatus(value: unknown): value is SeatStatus {
  return typeof value === 'string' && Object.values<string>(SeatStatus).includes(value);
}