import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { type GoalStatus } from '@aether/contract';

/** A goal, as a row. See `IdeaEntity` for the column conventions. */
@Entity('goals')
export class GoalEntity {
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
  status!: GoalStatus;

  @Column({ type: 'text', nullable: true })
  startsAt!: string | null;

  @Column({ type: 'text', nullable: true })
  targetAt!: string | null;

  @Column({ type: 'integer', nullable: true })
  priority!: number | null;

  @Column({ type: 'simple-array' })
  inspiredBy!: string[];

  @Column({ type: 'simple-array' })
  involves!: string[];

  @Column({ type: 'simple-array' })
  sources!: string[];

  @Column({ type: 'simple-array' })
  scheduled!: string[];

  /*
   * No column for `realizedBy` or `progress`. Both are derived from the
   * projects naming this goal — the first from their existence, the second
   * from the tasks inside them — and a column would be a second copy free to
   * disagree with the work it was counted from.
   */

  @Column({ type: 'text' })
  createdAt!: string;

  @Column({ type: 'text' })
  updatedAt!: string;
}
