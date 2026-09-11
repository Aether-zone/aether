import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ResourceEntity } from './resource.entity';

import { ResourceController } from './resource.controller';
import { ResourceService } from './resource.service';

/**
 * Tekmerion — evidence: the things a claim rests on.
 *
 * A resource here is the artefact itself. What it *means* is arachni’s
 * business and what it *says* is mneme’s; this is where it came from and
 * what it is.
 *
 * `Resource` is the only thing here, and it is held in memory like the rest
 * of aether's placeholder services — a worse fit here than elsewhere, since a
 * resource can carry a whole transcript. `ResourceService` is exported for
 * the domains that will want to reach one without going back out through
 * HTTP: mneme indexes what a resource says, arachni relates it to everything
 * else.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ResourceEntity])],
  controllers: [ResourceController],
  providers: [ResourceService],
  exports: [ResourceService],
})
export class TekmerionModule {}
