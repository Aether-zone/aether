import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { type IdeaStatus } from '@aether/contract';

/**
 * An idea, as a row.
 *
 * The columns mirror `ideaSchema` rather than reinterpreting it: the contract
 * is what the api validates against, and a store that disagreed with it would
 * fail at the boundary rather than here, where the disagreement is.
 *
 * **Times are `text`, not `datetime`.** The DTO's times are ISO 8601 strings,
 * and a `datetime` column would hand back a `Date` for the service to convert
 * on the way out — a conversion that can only lose. Stored as written, they
 * come back as written.
 *
 * **`id` is not generated.** The service mints it, because it also has to put
 * it in an event's `subject` before the row is written. A database-generated
 * id would mean writing first and announcing second, and the announcement
 * would be the thing that failed.
 */
@Entity('ideas')
export class IdeaEntity {
  @PrimaryColumn('uuid')
  id!: string;

  /**
   * The tenant. Indexed because every read filters on it — there is no query
   * in this service that does not.
   */
  @Index()
  @Column()
  organizationId!: string;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /*
   * `type: 'text'` is not decoration. The field's TypeScript type is a union
   * of string literals, and `emitDecoratorMetadata` emits `Object` for any
   * union — so TypeORM has nothing to infer from and refuses to build the
   * schema. Saying it here is the whole fix.
   */
  @Column({ type: 'text' })
  status!: IdeaStatus;

  @Column({ type: 'integer', nullable: true })
  priority!: number | null;

  /**
   * The people this idea is about.
   *
   * `simple-array`, which is a comma-joined string. Safe here because the
   * values are uuids and a uuid cannot contain a comma — the moment a list
   * holds free text this has to become `simple-json`.
   */
  @Column({ type: 'simple-array' })
  involves!: string[];

  @Column({ type: 'text' })
  createdAt!: string;

  @Column({ type: 'text' })
  updatedAt!: string;

  @Column()
  createdBy!: string;
}
