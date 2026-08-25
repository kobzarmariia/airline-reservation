export class InvalidPassengerAssignmentException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPassengerAssignmentException';
  }
}
