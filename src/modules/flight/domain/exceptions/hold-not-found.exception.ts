export class HoldNotFoundException extends Error {
  constructor(holdId: string) {
    super(`Hold "${holdId}" was not found.`);
    this.name = 'HoldNotFoundException';
  }
}
