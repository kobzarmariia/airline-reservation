export interface ConfirmSeatsCommandProps {
  flightId: string;
  holdId: string;
}

export class ConfirmSeatsCommand {
  readonly flightId: string;
  readonly holdId: string;

  constructor(props: ConfirmSeatsCommandProps) {
    this.flightId = props.flightId;
    this.holdId = props.holdId;
    Object.freeze(this);
  }
}
