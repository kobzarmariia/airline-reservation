import { it, describe, expect } from '@jest/globals';
import { MockPaymentAdapter } from './mock-payment.adapter';

describe('MockPaymentAdapter', () => {
  it('returns a successful result with a deterministic-format payment id for a valid token', async () => {
    const adapter = new MockPaymentAdapter(0);

    const result = await adapter.charge({
      reservationId: 'res_1',
      amount: 199.99,
      currency: 'USD',
      paymentMethodToken: 'tok_visa',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected a successful payment result.');
    }
    expect(result.paymentId).toMatch(/^pay_mock_[0-9a-f-]{36}$/);
  });

  it('returns a failure result when the payment method token is tok_fail', async () => {
    const adapter = new MockPaymentAdapter(0);

    const result = await adapter.charge({
      reservationId: 'res_1',
      amount: 199.99,
      currency: 'USD',
      paymentMethodToken: 'tok_fail',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected a failed payment result.');
    }
    expect(result.failureReason).toBe('Insufficient funds (simulated).');
  });

  it('defaults the simulated latency when none is provided', async () => {
    const adapter = new MockPaymentAdapter();

    const result = await adapter.charge({
      reservationId: 'res_1',
      amount: 50,
      currency: 'USD',
      paymentMethodToken: 'tok_visa',
    });

    expect(result.success).toBe(true);
  });
});
