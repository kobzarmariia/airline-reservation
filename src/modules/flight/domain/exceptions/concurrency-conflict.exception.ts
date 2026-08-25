export class ConcurrencyConflictException extends Error {
  constructor(flightId: string) {
    super(
      `Flight "${flightId}" was modified by another request. Please retry your operation.`,
    );
    this.name = 'ConcurrencyConflictException';
  }
}
