import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GroupController } from './group.controller';
import { GroupEntity } from './group.entity';
import { GroupService } from './group.service';
import { UserEntity } from './user.entity';

import { UserController } from './user.controller';
import { UserService } from './user.service';

/**
 * Prosopone — the person, and who they are to each other.
 *
 * A relationship is a resource in its own right rather than a field on a
 * person, because it carries facts belonging to neither end of it — when it
 * started, what kind it is. Only `User` exists so far.
 *
 * `UserService` is exported so a sibling domain can read people without going
 * back out through HTTP: chronos needs attendees, telos needs an assignee.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, GroupEntity])],
  controllers: [UserController, GroupController],
  providers: [UserService, GroupService],
  exports: [UserService, GroupService],
})
export class ProsoponeModule {}
