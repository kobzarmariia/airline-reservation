export class FlightNotFoundException extends Error {
  constructor(flightId: string) {
    super(`Flight "${flightId}" was not found.`);
    this.name = 'FlightNotFoundException';
  }
}
