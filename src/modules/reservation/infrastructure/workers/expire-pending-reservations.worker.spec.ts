import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import { CommandBus } from '@nestjs/cqrs';
import { ExpirePendingReservationsWorker } from './expire-pending-reservations.worker';
import { ExpirePendingReservationsCommand } from '../../application/commands/expire-pending-reservations/expire-pending-reservations.command';

describe('ExpirePendingReservationsWorker', () => {
  let commandBus: { execute: jest.Mock };
  let worker: ExpirePendingReservationsWorker;

  beforeEach(() => {
    commandBus = { execute: jest.fn(() => Promise.resolve(0)) };
    worker = new ExpirePendingReservationsWorker(
      commandBus as unknown as CommandBus,
    );
  });

  it('dispatches an ExpirePendingReservationsCommand with the current timestamp', async () => {
    await worker.handleExpiredReservations();

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const [dispatchedCommand] = commandBus.execute.mock.calls[0] as [
      ExpirePendingReservationsCommand,
    ];
    expect(dispatchedCommand).toBeInstanceOf(ExpirePendingReservationsCommand);
    expect(dispatchedCommand.now.getTime()).toBeCloseTo(Date.now(), -2);
  });

  it('logs an error and returns gracefully when the command handler fails', async () => {
    const errorLogSpy = jest
      .spyOn(worker['logger'], 'error')
      .mockImplementation(() => undefined);
    commandBus.execute.mockImplementationOnce(() =>
      Promise.reject(new Error('database unavailable')),
    );

    await expect(worker.handleExpiredReservations()).resolves.toBeUndefined();

    expect(errorLogSpy).toHaveBeenCalledTimes(1);
  });

  it('skips a run that starts while the previous one is still in flight', async () => {
    let resolveFirstRun!: (count: number) => void;
    commandBus.execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstRun = resolve;
        }),
    );

    const firstRun = worker.handleExpiredReservations();
    const secondRun = worker.handleExpiredReservations();

    resolveFirstRun(0);
    await Promise.all([firstRun, secondRun]);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
  });

  it('allows the next run to proceed once the previous run has completed', async () => {
    await worker.handleExpiredReservations();
    await worker.handleExpiredReservations();

    expect(commandBus.execute).toHaveBeenCalledTimes(2);
  });
});
