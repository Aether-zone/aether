import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { type ResourceSource, type ResourceType } from '@aether/contract';

/**
 * A resource, as a row.
 *
 * `content` has no length cap here for the reason the contract gives it none:
 * a limit that truncates is worse than no limit at all, and SQLite's `text`
 * holds whatever it is given.
 *
 * `source` and `metadata` are `simple-json`. Neither is a fixed shape —
 * `source` is an open-ended description of a system and `metadata` is
 * whatever that system wanted to keep — so columns would be either wrong or
 * endless. This is the one place in aether where a JSON blob is the honest
 * representation rather than a shortcut.
 *
 * `externalId` is indexed with the tenant: "have I already filed this" is the
 * question an importer asks before every write, and it is the only lookup here
 * that is not by id.
 */
@Entity('resources')
@Index(['organizationId', 'externalId'])
export class ResourceEntity {
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
  type!: ResourceType;

  @Column({ type: 'text', nullable: true })
  title!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  content!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  source!: ResourceSource | null;

  @Column({ type: 'text', nullable: true })
  externalId!: string | null;

  @Column({ type: 'text', nullable: true })
  url!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'text' })
  createdAt!: string;

  @Column({ type: 'text' })
  updatedAt!: string;
}
