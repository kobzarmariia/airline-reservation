export class HoldSeatsResponseDto {
  readonly holdId: string;
  readonly flightId: string;
  readonly seatNumbers: string[];
  readonly expiresAt: string;

  constructor(props: {
    holdId: string;
    flightId: string;
    seatNumbers: string[];
    expiresAt: string;
  }) {
    this.holdId = props.holdId;
    this.flightId = props.flightId;
    this.seatNumbers = props.seatNumbers;
    this.expiresAt = props.expiresAt;
  }
}
