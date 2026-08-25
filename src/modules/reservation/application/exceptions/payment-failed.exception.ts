export class PaymentFailedException extends Error {
  constructor(public readonly failureReason: string) {
    super(`Payment failed: ${failureReason}`);
    this.name = 'PaymentFailedException';
  }
}
