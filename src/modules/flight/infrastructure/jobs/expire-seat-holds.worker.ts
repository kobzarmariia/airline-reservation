import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';
import { FLIGHT_REPOSITORY_PORT } from '../../domain/repositories/flight.repository.interface';
import type { FlightRepositoryPort } from '../../domain/repositories/flight.repository.interface';
import { ReleaseSeatsCommand } from '../../application/commands/release-seats/release-seats.command';

@Injectable()
export class ExpireSeatHoldsWorker {
  private readonly logger = new Logger(ExpireSeatHoldsWorker.name);

  // Guards against overlapping runs: if a sweep is still working through a
  // large batch when the next tick fires, skip it rather than let two runs
  // race on the same holds.
  private isRunning = false;

  constructor(
    @Inject(FLIGHT_REPOSITORY_PORT)
    private readonly flightRepository: FlightRepositoryPort,
    private readonly commandBus: CommandBus,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredHolds(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        'Skipping expired-hold sweep: previous run is still in progress.',
      );
      return;
    }
    this.isRunning = true;

    try {
      const now = new Date();
      const flights =
        await this.flightRepository.findFlightsWithExpiredHolds(now);

      for (const flight of flights) {
        const flightId = flight.getId().value;
        const expiredHoldIds = flight.getExpiredHoldIds(now);

        for (const holdId of expiredHoldIds) {
          try {
            await this.commandBus.execute(
              new ReleaseSeatsCommand({ flightId, holdId }),
            );
            this.logger.log(
              `Released expired hold "${holdId}" on flight "${flightId}".`,
            );
          } catch (error) {
            // One failed release must not abort the rest of the batch — log
            // and move on so other flights/holds still get cleaned up.
            this.logger.error(
              `Failed to release expired hold "${holdId}" on flight "${flightId}".`,
              error instanceof Error ? error.stack : String(error),
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        'Failed to query flights with expired holds.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }
}
