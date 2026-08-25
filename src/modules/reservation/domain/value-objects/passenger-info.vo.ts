import { InvalidPassengerInfoException } from '../exceptions/invalid-passenger-info.exception';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PassengerInfoProps {
  firstName: string;
  lastName: string;
  email: string;
  passportNumber?: string | null;
}

export class PassengerInfo {
  private constructor(
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly email: string,
    public readonly passportNumber: string | null,
  ) {
    Object.freeze(this);
  }

  static create(props: PassengerInfoProps): PassengerInfo {
    const firstName = props.firstName.trim();
    const lastName = props.lastName.trim();
    const email = props.email.trim().toLowerCase();
    const passportNumber = props.passportNumber?.trim() ?? null;

    if (firstName.length === 0) {
      throw new InvalidPassengerInfoException(
        'Passenger firstName must not be empty.',
      );
    }
    if (lastName.length === 0) {
      throw new InvalidPassengerInfoException(
        'Passenger lastName must not be empty.',
      );
    }
    if (!EMAIL_PATTERN.test(email)) {
      throw new InvalidPassengerInfoException(
        `Invalid passenger email: "${props.email}".`,
      );
    }
    if (passportNumber !== null && passportNumber.length === 0) {
      throw new InvalidPassengerInfoException(
        'Passenger passportNumber must not be blank when provided.',
      );
    }

    return new PassengerInfo(firstName, lastName, email, passportNumber);
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  equals(other: PassengerInfo): boolean {
    return (
      other instanceof PassengerInfo &&
      this.firstName === other.firstName &&
      this.lastName === other.lastName &&
      this.email === other.email &&
      this.passportNumber === other.passportNumber
    );
  }
}
