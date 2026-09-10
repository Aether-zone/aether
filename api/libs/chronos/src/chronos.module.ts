import { Module } from '@nestjs/common';

import { ProsoponeModule } from '@aether/prosopone';
import { ToposModule } from '@aether/topos';

import { EventController } from './event.controller';
import { EventService } from './event.service';

/**
 * Chronos — time.
 *
 * A schedule is the rule and an event is one occurrence of it, which is why a
 * recurring meeting is one schedule and many events rather than a single
 * resource that has to mean both. Only `Event` exists so far.
 *
 * It imports the two domains an event points at. One direction only: neither
 * prosopone nor topos knows anything about the calendar, which is what keeps
 * this from being a cycle — a person exists whether or not they are expected
 * anywhere.
 */
@Module({
  imports: [ProsoponeModule, ToposModule],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class ChronosModule {}
