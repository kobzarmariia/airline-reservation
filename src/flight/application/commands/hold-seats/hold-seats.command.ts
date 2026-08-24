export interface HoldSeatsCommandProps {
  flightId: string;
  seatNumbers: string[];
  holdId: string;
  expiresAt: Date;
}

export class HoldSeatsCommand {
  readonly flightId: string;
  readonly seatNumbers: readonly string[];
  readonly holdId: string;
  readonly expiresAt: Date;

  constructor(props: HoldSeatsCommandProps) {
    this.flightId = props.flightId;
    this.seatNumbers = Object.freeze([...props.seatNumbers]);
    this.holdId = props.holdId;
    this.expiresAt = props.expiresAt;
    Object.freeze(this);
  }
}
