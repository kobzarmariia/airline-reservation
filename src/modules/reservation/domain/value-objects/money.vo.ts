import { InvalidMoneyException } from '../exceptions/invalid-money.exception';

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

// amount is stored in integer minor units (cents), e.g. 15000 === $150.00,
// to avoid floating-point rounding errors in monetary arithmetic.
export class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {
    Object.freeze(this);
  }

  static create(amount: number, currency: string): Money {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new InvalidMoneyException(
        `Money amount must be a non-negative integer number of cents. Received: ${amount}.`,
      );
    }
    const normalizedCurrency = currency.trim().toUpperCase();
    if (!CURRENCY_CODE_PATTERN.test(normalizedCurrency)) {
      throw new InvalidMoneyException(
        `Invalid currency code: "${currency}". Expected a 3-letter ISO 4217 code (e.g. "USD").`,
      );
    }
    return new Money(amount, normalizedCurrency);
  }

  static zero(currency: string): Money {
    return Money.create(0, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new InvalidMoneyException(
        `Cannot add Money of mismatched currencies: "${this.currency}" and "${other.currency}".`,
      );
    }
    return Money.create(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return (
      other instanceof Money &&
      this.amount === other.amount &&
      this.currency === other.currency
    );
  }

  toString(): string {
    return `${(this.amount / 100).toFixed(2)} ${this.currency}`;
  }
}
