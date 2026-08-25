export interface ReleaseSeatsCommandProps {
  flightId: string;
  holdId: string;
}

export class ReleaseSeatsCommand {
  readonly flightId: string;
  readonly holdId: string;

  constructor(props: ReleaseSeatsCommandProps) {
    this.flightId = props.flightId;
    this.holdId = props.holdId;
    Object.freeze(this);
  }
}
