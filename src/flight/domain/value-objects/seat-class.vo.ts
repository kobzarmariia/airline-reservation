export const SEAT_CLASSES = ['ECONOMY', 'BUSINESS', 'FIRST'] as const;

export type SeatClass = (typeof SEAT_CLASSES)[number];

export function isSeatClass(value: string): value is SeatClass {
  return (SEAT_CLASSES as readonly string[]).includes(value);
}
