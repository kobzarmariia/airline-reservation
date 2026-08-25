import { Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  PaymentGatewayPort,
  ProcessPaymentInput,
  ProcessPaymentResult,
} from '../../application/ports/payment-gateway.port';

const FAILING_TOKEN = 'tok_fail';
const DEFAULT_SIMULATED_LATENCY_MS = 150;

@Injectable()
export class MockPaymentAdapter implements PaymentGatewayPort {
  private readonly simulatedLatencyMs: number;

  constructor(@Optional() simulatedLatencyMs?: number) {
    this.simulatedLatencyMs =
      simulatedLatencyMs ?? DEFAULT_SIMULATED_LATENCY_MS;
  }

  async charge(input: ProcessPaymentInput): Promise<ProcessPaymentResult> {
    await this.simulateLatency();

    if (input.paymentMethodToken === FAILING_TOKEN) {
      return {
        success: false,
        failureReason: 'Insufficient funds (simulated).',
      };
    }

    return {
      success: true,
      paymentId: `pay_mock_${randomUUID()}`,
    };
  }

  private async simulateLatency(): Promise<void> {
    if (this.simulatedLatencyMs <= 0) {
      return;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, this.simulatedLatencyMs),
    );
  }
}
