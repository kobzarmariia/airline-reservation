export const PAYMENT_GATEWAY_PORT = Symbol('PaymentGatewayPort');

export interface ProcessPaymentInput {
  reservationId: string;
  amount: number;
  currency: string;
  paymentMethodToken: string;
}

export interface ProcessPaymentSuccess {
  readonly success: true;
  readonly paymentId: string;
}

export interface ProcessPaymentFailure {
  readonly success: false;
  readonly failureReason: string;
}

export type ProcessPaymentResult =
  ProcessPaymentSuccess | ProcessPaymentFailure;

export interface PaymentGatewayPort {
  charge(input: ProcessPaymentInput): Promise<ProcessPaymentResult>;
}
