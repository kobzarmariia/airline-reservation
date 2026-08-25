export interface ConfirmReservationCommandProps {
  reservationId: string;
  paymentMethodToken: string;
}

export class ConfirmReservationCommand {
  readonly reservationId: string;
  readonly paymentMethodToken: string;

  constructor(props: ConfirmReservationCommandProps) {
    this.reservationId = props.reservationId;
    this.paymentMethodToken = props.paymentMethodToken;
    Object.freeze(this);
  }
}
