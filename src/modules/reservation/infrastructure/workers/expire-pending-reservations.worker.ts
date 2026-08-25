import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';
import { ExpirePendingReservationsCommand } from '../../application/commands/expire-pending-reservations/expire-pending-reservations.command';

@Injectable()
export class ExpirePendingReservationsWorker {
  private readonly logger = new Logger(ExpirePendingReservationsWorker.name);

  // Guards against overlapping runs: if a sweep is still working through a
  // large batch when the next tick fires, skip it rather than let two runs
  // race on the same reservations.
  private isRunning = false;

  constructor(private readonly commandBus: CommandBus) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredReservations(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        'Skipping expired-reservation sweep: previous run is still in progress.',
      );
      return;
    }
    this.isRunning = true;

    try {
      const expiredCount = await this.commandBus.execute<
        ExpirePendingReservationsCommand,
        number
      >(new ExpirePendingReservationsCommand(new Date()));

      if (expiredCount > 0) {
        this.logger.log(`Expired ${expiredCount} pending reservation(s).`);
      }
    } catch (error) {
      this.logger.error(
        'Failed to run expired-reservation sweep.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }
}
