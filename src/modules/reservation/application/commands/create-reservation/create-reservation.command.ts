export interface CreateReservationPassengerInput {
  firstName: string;
  lastName: string;
  email: string;
  passportNumber?: string | null;
}

export interface CreateReservationSeatAssignmentInput {
  seatNumber: string;
  passenger: CreateReservationPassengerInput;
}

export interface CreateReservationCommandProps {
  flightId: string;
  holdId: string;
  seatAssignments: CreateReservationSeatAssignmentInput[];
}

export class CreateReservationCommand {
  readonly flightId: string;
  readonly holdId: string;
  readonly seatAssignments: readonly CreateReservationSeatAssignmentInput[];

  constructor(props: CreateReservationCommandProps) {
    this.flightId = props.flightId;
    this.holdId = props.holdId;
    this.seatAssignments = Object.freeze([...props.seatAssignments]);
    Object.freeze(this);
  }
}
