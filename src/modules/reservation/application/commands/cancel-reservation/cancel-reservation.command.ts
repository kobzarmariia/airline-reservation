export interface CancelReservationCommandProps {
  reservationId: string;
  reason: string;
}

export class CancelReservationCommand {
  readonly reservationId: string;
  readonly reason: string;

  constructor(props: CancelReservationCommandProps) {
    this.reservationId = props.reservationId;
    this.reason = props.reason;
    Object.freeze(this);
  }
}
