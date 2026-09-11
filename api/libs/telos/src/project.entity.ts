import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { type ProjectStatus } from '@aether/contract';

/** A project, as a row. See `IdeaEntity` for the column conventions. */
@Entity('projects')
export class ProjectEntity {
  @PrimaryColumn('uuid')
  id!: string;

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
  status!: ProjectStatus;

  @Column({ type: 'text', nullable: true })
  startsAt!: string | null;

  @Column({ type: 'text', nullable: true })
  targetAt!: string | null;

  @Column({ type: 'integer', nullable: true })
  priority!: number | null;

  /** The goals this project is meant to reach — the chain's third link. */
  @Column({ type: 'simple-array' })
  pursues!: string[];

  @Column({ type: 'simple-array' })
  involves!: string[];

  /*
   * No column for `tasks`. Those counts are read from the tasks table, and a
   * stored pair would go stale the moment one was ticked off.
   */

  @Column({ type: 'text' })
  createdAt!: string;

  @Column({ type: 'text' })
  updatedAt!: string;
}
