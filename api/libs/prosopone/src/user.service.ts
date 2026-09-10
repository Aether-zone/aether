import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  AETHER_SOURCE,
  PERSON_CREATED,
  PERSON_DELETED,
  PERSON_UPDATED,
} from '@aether/contract';
import type {
  CreateUserDTO,
  UpdateUserDTO,
  UserDTO,
} from '@aether/contract';
import {
  EventPublisher,
  type Actor,
  type AetherEvent,
  type AetherEventType,
} from '@aether-zone/organon';

import { personIri, toPersonDocument, type PersonJsonLD } from './user.json-ld';

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

  constructor(private readonly events: EventPublisher) {}

  /**
   * Keyed by `organizationId/id`, so one tenant's ids cannot collide with
   * another's and a lookup is not a scan.
   */
  private readonly users = new Map<string, StoredUser>();

  /** Every user in this organization, oldest first — a Map keeps insertion order. */
  list(actor: Actor): UserDTO[] {
    return [...this.users.values()]
      .filter((user) => user.organizationId === actor.organizationId)
      .map(toDto);
  }

  /**
   * One user, or a 404.
   *
   * A person in another organization gives the same 404 as one that does not
   * exist. Telling the two apart would answer "does this id exist somewhere"
   * for anyone who cared to ask.
   */
  get(actor: Actor, id: string): UserDTO {
    return toDto(this.stored(actor, id));
  }

  /**
   * Records a new person.
   *
   * The id is generated here rather than accepted from the caller — the
   * contract's `createUserSchema` omits it for the same reason. `randomUUID`
   * is Node's own, so this needs no dependency to make one.
   */
  async create(actor: Actor, input: CreateUserDTO): Promise<UserDTO> {
    this.refuseDuplicateEmail(actor, input.email);

    const user: StoredUser = {
      id: randomUUID(),
      organizationId: actor.organizationId,
      ...input,
    };

    this.users.set(key(actor.organizationId, user.id), user);

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
  private async announce(
    routingKey: string,
    type: AetherEventType,
    user: StoredUser,
    actor: Actor,
  ): Promise<void> {
    const event: AetherEvent<PersonJsonLD> = {
      /*
       * Overwritten before it leaves. `EventPublisher` spreads its transport
       * envelope *last*, so the id on the wire is the message's, not this one
       * — confirmed by watching the exchange. It is set anyway because the
       * type requires it, and organon's guidance is to treat the envelope's id
       * as the one identifying the message. akouo publishes the same way.
       */
      id: randomUUID(),
      type,
      source: AETHER_SOURCE,
      time: new Date().toISOString(),
      /*
       * The person's IRI, and it must equal the document's `@id`: organon's
       * schema refuses an event where the two disagree, because they are the
       * same fact stated twice and a consumer would file the document under
       * the wrong node.
       */
      subject: personIri(user.id),
      /*
       * Which tenant the person belongs to. Not decoration: arachni refuses to
       * write a node it cannot scope and mneme refuses to index text it cannot
       * file, so an event without this is *accepted by the schema and dropped
       * by every consumer* — and akouo cannot insert it at all, because its
       * `organizationId` column is NOT NULL. Verified by watching an earlier
       * version of this event reach arachni and leave no row behind.
       */
      organizationId: user.organizationId,
      /*
       * **No `organizationId`, and that has a consequence worth knowing.**
       *
       * The field is optional in organon's schema, so this is a valid Aether
       * event — but both consumers on the exchange drop an event without one:
       * arachni refuses to write a node it cannot scope, and mneme refuses to
       * index text it cannot file. Either would be putting one tenant's data
       * where another could read it.
       *
       * Nothing here can supply it honestly. This api's users are not scoped
       * to an organization — the route is `/users`, not
       * `/organizations/:id/users` — so the request never named one, and
       * taking the caller's first membership would be attributing the person
       * to a tenant nobody chose. The event is emitted as the truth it is:
       * a person exists, in no stated organization.
       *
       * Scoping the store is what fixes this, and it is a breaking change to
       * the route.
       */
      /*
       * A delete carries no `data` — there is nothing left to describe, and
       * organon's schema has no field for it on that variant. The subject is
       * the whole of what a consumer needs to find its copy.
       */
      ...(type === 'aether:ResourceDeleted'
        ? {}
        : { data: toPersonDocument(user) }),
      actor: { id: actor.id, type: 'User' },
    } as AetherEvent<PersonJsonLD>;

    try {
      await this.events.publish(routingKey, event);
    } catch (cause) {
      this.logger.error(
        `Person ${event.subject} changed but "${routingKey}" could not be published`,
        cause,
      );
    }
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
    const existing = this.stored(actor, id);

    if (changes.email && changes.email !== existing.email) {
      this.refuseDuplicateEmail(actor, changes.email);
    }

    const updated: StoredUser = { ...existing, ...changes };

    this.users.set(key(actor.organizationId, id), updated);

    /*
     * The whole document, not the changed fields. An Aether event describes
     * the resource as it now is: a consumer holding a copy replaces it, and
     * one hearing about this person for the first time — because it missed the
     * create, or was deployed yesterday — still ends up with everything. A
     * patch would only work for consumers that already agreed with us.
     */
    await this.announce(PERSON_UPDATED, 'aether:ResourceUpdated', updated, actor);

    return toDto(updated);
  }

  /**
   * 409 rather than 400: the request is well formed, and what is wrong with it
   * is the state of the store rather than the shape of the body.
   *
   * The comparison needs no `toLowerCase` — the contract lowercases on the way
   * in, so every address in here is already in one spelling.
   */
  private refuseDuplicateEmail(actor: Actor, email: string): void {
    for (const user of this.users.values()) {
      if (user.organizationId === actor.organizationId && user.email === email) {
        throw new ConflictException(`${email} already belongs to a user.`);
      }
    }
  }

  /** Forgets a person. Deleting one who is not here is a 404, not a shrug. */
  async remove(actor: Actor, id: string): Promise<void> {
    // `stored` for the side effect of throwing: deleting nothing and reporting
    // success would hide a caller working from a stale list.
    const removed = this.stored(actor, id);

    this.users.delete(key(actor.organizationId, id));

    await this.announce(PERSON_DELETED, 'aether:ResourceDeleted', removed, actor);
  }

  /** The stored record, including the tenant the DTO does not carry. */
  private stored(actor: Actor, id: string): StoredUser {
    const user = this.users.get(key(actor.organizationId, id));

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
type StoredUser = UserDTO & { organizationId: string };

const key = (organizationId: string, id: string) => `${organizationId}/${id}`;

const toDto = ({ organizationId: _organizationId, ...user }: StoredUser): UserDTO =>
  user;
