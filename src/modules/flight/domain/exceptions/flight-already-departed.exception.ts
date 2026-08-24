export class FlightAlreadyDepartedException extends Error {
  constructor() {
    super('Cannot modify seats on a flight that has already departed.');
    this.name = 'FlightAlreadyDepartedException';
  }
}
