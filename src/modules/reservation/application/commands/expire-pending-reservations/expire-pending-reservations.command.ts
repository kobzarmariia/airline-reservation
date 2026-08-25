export class ExpirePendingReservationsCommand {
  readonly now: Date;

  constructor(now: Date = new Date()) {
    this.now = now;
    Object.freeze(this);
  }
}
