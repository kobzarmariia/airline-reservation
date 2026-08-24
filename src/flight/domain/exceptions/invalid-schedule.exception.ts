export class InvalidScheduleException extends Error {
  constructor(departureTime: Date, arrivalTime: Date) {
    super(
      `Invalid schedule: arrival time (${arrivalTime.toISOString()}) must be after departure time (${departureTime.toISOString()}).`,
    );
    this.name = 'InvalidScheduleException';
  }
}
