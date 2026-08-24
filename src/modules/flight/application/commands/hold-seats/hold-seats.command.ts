export interface HoldSeatsCommandProps {
  flightId: string;
  seatNumbers: string[];
  holdId: string;
}

export class HoldSeatsCommand {
  readonly flightId: string;
  readonly seatNumbers: readonly string[];
  readonly holdId: string;

  constructor(props: HoldSeatsCommandProps) {
    this.flightId = props.flightId;
    this.seatNumbers = Object.freeze([...props.seatNumbers]);
    this.holdId = props.holdId;
    Object.freeze(this);
  }
}
