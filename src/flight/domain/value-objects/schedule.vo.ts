import { InvalidScheduleException } from '../exceptions/invalid-schedule.exception';

export class Schedule {
  private constructor(
    public readonly departureTime: Date,
    public readonly arrivalTime: Date,
  ) {}

  static create(departureTime: Date, arrivalTime: Date): Schedule {
    if (arrivalTime.getTime() <= departureTime.getTime()) {
      throw new InvalidScheduleException(departureTime, arrivalTime);
    }
    return new Schedule(departureTime, arrivalTime);
  }

  hasDeparted(referenceDate: Date = new Date()): boolean {
    return referenceDate.getTime() >= this.departureTime.getTime();
  }
}
