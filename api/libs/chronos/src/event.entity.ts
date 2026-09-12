import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { type EventDTO } from '@aether/contract';

/**
 * A calendar entry, as a row.
 *
 * It stores the *ids* of the place and the people, not copies of them — which
 * is what the service already did in memory. A copy taken when the event was
 * created would go on asserting a name or an address that has since changed,
 * and a calendar that lies about where a meeting is is worse than one that
 * cannot say.
 */
@Entity('events')
export class EventEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column()
  organizationId!: string;

  /*
   * `type: 'text'` is not decoration. The field's TypeScript type is a union
   * of string literals, and `emitDecoratorMetadata` emits `Object` for any
   * union — so TypeORM has nothing to infer from and refuses to build the
   * schema. Saying it here is the whole fix.
   */
  @Column({ type: 'text' })
  type!: EventDTO['type'];

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Indexed: a calendar is read by when, and this is the column it reads by. */
  @Index()
  @Column({ type: 'text' })
  startsAt!: string;

  @Column({ type: 'text', nullable: true })
  endsAt!: string | null;

  @Column({ type: 'text', nullable: true })
  locationId!: string | null;

  @Column({ type: 'text', nullable: true })
  organizerId!: string | null;

  @Column({ type: 'simple-array' })
  attendeeIds!: string[];

  /*
   * `type: 'text'` is not decoration. The field's TypeScript type is a union
   * of string literals, and `emitDecoratorMetadata` emits `Object` for any
   * union — so TypeORM has nothing to infer from and refuses to build the
   * schema. Saying it here is the whole fix.
   */
  @Column({ type: 'text' })
  status!: EventDTO['status'];

  @Column({ type: 'text' })
  createdAt!: string;

  @Column({ type: 'text' })
  updatedAt!: string;
}
