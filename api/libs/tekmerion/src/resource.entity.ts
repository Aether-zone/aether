import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import {
  type RelationTargetDTO,
  type ResourceSource,
  type ResourceType,
} from '@aether/contract';

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

  /**
   * Free-text labels, already lowercased by the contract.
   *
   * `simple-array` — a comma-joined string — which is the one place in aether
   * where that choice is a genuine constraint rather than a safe default: a
   * tag containing a comma would split in two on the way back out. The schema
   * does not forbid one, so this is a limit worth remembering when tags grow
   * a syntax.
   */
  @Column({ type: 'simple-array' })
  tags!: string[];

  @Column({ type: 'simple-array' })
  involves!: string[];

  /*
   * The three relation arrays.
   *
   * `simple-json` rather than `simple-array`, which holds a comma-joined
   * string and so cannot hold objects at all — and these are `{kind, id}`
   * pairs, because the target set is heterogeneous and an id alone cannot say
   * which IRI to mint from it.
   *
   * Nullable, and normalised to `[]` on the way out. Not because "no
   * relations" is a different state from "none stated" — it is not — but
   * because `synchronize` adds a column to a table that already has rows, and
   * a NOT NULL column with no default cannot be added to one. A row written
   * before these existed reads as null and means the same as empty.
   */
  @Column({ type: 'simple-json', nullable: true })
  about!: RelationTargetDTO[] | null;

  @Column({ type: 'simple-json', nullable: true })
  relatedTo!: RelationTargetDTO[] | null;

  @Column({ type: 'simple-json', nullable: true })
  mentions!: RelationTargetDTO[] | null;

  /** The stored object this resource is, where it is one. */
  @Column({ type: 'text', nullable: true })
  fileId!: string | null;

  @Column({ type: 'text' })
  createdAt!: string;

  @Column({ type: 'text' })
  updatedAt!: string;
}
