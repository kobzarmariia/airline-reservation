export class InvalidMoneyException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMoneyException';
  }
}
