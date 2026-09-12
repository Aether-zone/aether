import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { announce } from '@aether/events';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import {
  PERSON_CREATED,
  PERSON_DELETED,
  PERSON_UPDATED,
} from '@aether/contract';
import type { CreateUserDTO, UpdateUserDTO, UserDTO } from '@aether/contract';
import {
  EventPublisher,
  type Actor,
  type AetherEventType,
} from '@aether-zone/organon';

import { UserEntity } from './user.entity';
import { personIri, toPersonDocument } from './user.json-ld';

/**
 * The people prosopone knows about.
 *
 * **In memory, deliberately and temporarily.** Everything is lost on restart
 * and nothing is shared between instances, so this is a placeholder for a
 * repository and not a cache in front of one. It exists so the controller and
 * the console can be built against a real shape now; swapping it for a
 * persistent store should change nothing above this class, which is why the
 * methods return plain DTOs and take no entity type of their own.
 *
 * **Scoped to an organization.** Every method takes the `Actor` the route's
 * guard produced and can only see that organization's people, so there is no
 * call path that reads across the boundary — the tenant is a parameter rather
 * than something a caller may remember to filter by.
 *
 * One rule is enforced here rather than left to the database it does not have
 * yet: an email address identifies at most one person *within an
 * organization*. A store that allowed two would make "find the person with
 * this address" ambiguous, and the duplicate is far cheaper to refuse than to
 * merge afterwards. Across organizations the same address is a different
 * person, so the check is scoped too.
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  /**
   * Keyed by `organizationId/id`, so one tenant's ids cannot collide with
   * another's and a lookup is not a scan.
   */
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly events: EventPublisher,
  ) {}

  /** Every user in this organization, oldest first — a Map keeps insertion order. */
  async list(actor: Actor): Promise<UserDTO[]> {
    const rows = await this.users.find({
      where: { organizationId: actor.organizationId },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });

    return rows.map(toDto);
  }

  /**
   * One user, or a 404.
   *
   * A person in another organization gives the same 404 as one that does not
   * exist. Telling the two apart would answer "does this id exist somewhere"
   * for anyone who cared to ask.
   */
  async get(actor: Actor, id: string): Promise<UserDTO> {
    return toDto(await this.stored(actor, id));
  }

  /**
   * Records a new person.
   *
   * The id is generated here rather than accepted from the caller — the
   * contract's `createUserSchema` omits it for the same reason. `randomUUID`
   * is Node's own, so this needs no dependency to make one.
   */
  async create(actor: Actor, input: CreateUserDTO): Promise<UserDTO> {
    await this.refuseDuplicateEmail(actor, input.email);

    const user = await this.users.save(
      this.users.create({
        id: randomUUID(),
        organizationId: actor.organizationId,
        ...input,
        note: input.note ?? null,
        groupId: input.groupId ?? null,
      }),
    );

    await this.announce(PERSON_CREATED, 'aether:ResourceCreated', user, actor);

    return toDto(user);
  }

  /**
   * Tells the rest of aether-zone that a person now exists.
   *
   * Published *after* the record is stored, so nothing can hear about a person
   * that is not there. The reverse gap is real and accepted: the store can
   * succeed and the publish fail, leaving a person nobody downstream knows
   * about. That is logged loudly rather than swallowed, and the record is
   * still here to replay from.
   *
   * The honest fix is an outbox — write the event in the same transaction as
   * the row and let a relay publish it. There is no transaction to write it in
   * yet, because the store is a `Map`; this comment is where to start when
   * there is.
   *
   * A failure here does not fail the request. The person *was* created, and
   * answering 500 would invite a retry that creates a second one.
   */
  private announce(
    routingKey: string,
    type: AetherEventType,
    user: StoredUser,
    actor: Actor,
  ): Promise<void> {
    return announce(this.events, this.logger, {
      routingKey,
      type,
      /*
       * The person's IRI, and it must equal the document's `@id`: organon's
       * schema refuses an event where the two disagree, because they are the
       * same fact stated twice and a consumer would file the document under
       * the wrong node.
       */
      subject: personIri(user.id),
      organizationId: user.organizationId,
      actor,
      document: toPersonDocument(toDto(user)),
    });
  }

  /**
   * Changes the fields given and leaves the rest alone.
   *
   * A partial update rather than a replace, matching `updateUserSchema`: a
   * caller changing a phone number should not have to read the record back and
   * send it whole, and a replace would silently clear anything they forgot.
   */
  async update(
    actor: Actor,
    id: string,
    changes: UpdateUserDTO,
  ): Promise<UserDTO> {
    const existing = await this.stored(actor, id);

    if (changes.email && changes.email !== existing.email) {
      await this.refuseDuplicateEmail(actor, changes.email);
    }

    const updated = await this.users.save({
      ...existing,
      ...changes,
      // `undefined` leaves these alone and `null` removes them; the spread
      // cannot be trusted with the distinction.
      note: merge(existing.note, changes.note),
      groupId: merge(existing.groupId, changes.groupId),
    });

    /*
     * The whole document, not the changed fields. An Aether event describes
     * the resource as it now is: a consumer holding a copy replaces it, and
     * one hearing about this person for the first time — because it missed the
     * create, or was deployed yesterday — still ends up with everything. A
     * patch would only work for consumers that already agreed with us.
     */
    await this.announce(
      PERSON_UPDATED,
      'aether:ResourceUpdated',
      updated,
      actor,
    );

    return toDto(updated);
  }

  /**
   * 409 rather than 400: the request is well formed, and what is wrong with it
   * is the state of the store rather than the shape of the body.
   *
   * The comparison needs no `toLowerCase` — the contract lowercases on the way
   * in, so every address in here is already in one spelling.
   */
  private async refuseDuplicateEmail(
    actor: Actor,
    email: string,
  ): Promise<void> {
    /*
     * Checked here *and* enforced by a unique index on the table. The check
     * is what turns it into a 409 with a sentence somebody can read; the index
     * is what makes it true when two requests arrive at once and both find
     * nothing.
     */
    const taken = await this.users.findOneBy({
      organizationId: actor.organizationId,
      email,
    });

    if (taken) {
      throw new ConflictException(`${email} already belongs to a user.`);
    }
  }

  /** Forgets a person. Deleting one who is not here is a 404, not a shrug. */
  async remove(actor: Actor, id: string): Promise<void> {
    // `stored` for the side effect of throwing: deleting nothing and reporting
    // success would hide a caller working from a stale list.
    const removed = await this.stored(actor, id);

    await this.users.remove({ ...removed });

    await this.announce(
      PERSON_DELETED,
      'aether:ResourceDeleted',
      removed,
      actor,
    );
  }

  /** The stored record, including the tenant the DTO does not carry. */
  private async stored(actor: Actor, id: string): Promise<UserEntity> {
    // The tenant is part of the lookup, not a check after it: asked this way
    // the query cannot return another organization's row at all.
    const user = await this.users.findOneBy({
      id,
      organizationId: actor.organizationId,
    });

    if (!user) {
      throw new NotFoundException(`No user with id ${id}.`);
    }

    return user;
  }
}

/**
 * A user as held here: the DTO plus the tenant it belongs to.
 *
 * `organizationId` is deliberately not in `UserDTO`. It is in the URL of every
 * route that can reach the record, so returning it in the body would be
 * restating what the caller already said — and a client that read it from the
 * body might start sending it *as* the body.
 */
type StoredUser = UserEntity;

/** `undefined` keeps what is there; `null` clears it. */
const merge = <T>(current: T | null, change: T | null | undefined): T | null =>
  change === undefined ? current : change;

/** A row as the api answers with it: tenant dropped, `null` becomes absent. */
const toDto = (user: UserEntity): UserDTO => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  ...(user.note === null ? {} : { note: user.note }),
  ...(user.groupId === null ? {} : { groupId: user.groupId }),
});
