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

export interface RefundPaymentInput {
  paymentId: string;
  amount: number;
  currency: string;
  reason: string;
}

export interface RefundPaymentSuccess {
  readonly success: true;
  readonly refundId: string;
}

export interface RefundPaymentFailure {
  readonly success: false;
  readonly failureReason: string;
}

export type RefundPaymentResult = RefundPaymentSuccess | RefundPaymentFailure;

export interface PaymentGatewayPort {
  charge(input: ProcessPaymentInput): Promise<ProcessPaymentResult>;
  refund(input: RefundPaymentInput): Promise<RefundPaymentResult>;
}
