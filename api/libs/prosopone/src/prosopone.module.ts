import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class ProsoponeModule {}
