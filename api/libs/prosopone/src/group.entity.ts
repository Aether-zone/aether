import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { type GroupType } from '@aether/contract';

/**
 * A group of people, as a row.
 *
 * `id` is the group — a company, a community, a family. `organizationId` is
 * the tenant whose copy of that record this is, the one from pistis's `orgs`
 * claim that decides who may read the row at all.
 *
 * The two being named differently is the point. This table once called the
 * first one an organization too, which made `organization.organizationId` a
 * line somebody had to stop and parse — and the kind of line that eventually
 * gets used for the wrong thing.
 */
@Entity('groups')
export class GroupEntity {
  /** The group this record is about. */
  @PrimaryColumn('uuid')
  id!: string;

  /** The tenant whose copy this is. */
  @Index()
  @Column()
  organizationId!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /*
   * `type: 'text'` because the field's type is a union of string literals, and
   * `emitDecoratorMetadata` emits `Object` for any union — TypeORM would have
   * nothing to infer from and would refuse to build the schema.
   */
  @Column({ type: 'text', nullable: true })
  type!: GroupType | null;

  @Column({ type: 'text' })
  createdAt!: string;

  @Column({ type: 'text' })
  updatedAt!: string;
}
