import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlaceEntity } from './place.entity';

import { PlaceController } from './place.controller';
import { PlaceService } from './place.service';

/**
 * Topos — place, at three grains.
 *
 * A place is somewhere with a name, an address is how post reaches it, a
 * location is a point on the ground. One building can have all three and they
 * change independently.
 *
 * Only `Place` exists so far, and it carries its address as text rather than
 * pointing at an `Address` resource — see the note on `placeSchema`.
 *
 * `PlaceService` is exported so a sibling domain can read places without going
 * back out through HTTP: chronos will want somewhere for a meeting to be.
 */
@Module({
  imports: [TypeOrmModule.forFeature([PlaceEntity])],
  controllers: [PlaceController],
  providers: [PlaceService],
  exports: [PlaceService],
})
export class ToposModule {}
