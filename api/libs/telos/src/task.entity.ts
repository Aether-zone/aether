import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { type TaskStatus } from '@aether/contract';

/** A task, as a row. See `IdeaEntity` for the column conventions. */
@Entity('tasks')
export class TaskEntity {
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
  status!: TaskStatus;

  @Column({ type: 'integer', nullable: true })
  priority!: number | null;

  /**
   * The project this belongs to, or null for a loose one.
   *
   * Indexed: a project's page counts its tasks on every read, and that is the
   * only query in this service that is not already narrowed by the tenant.
   */
  @Index()
  @Column({ type: 'text', nullable: true })
  projectId!: string | null;

  @Column({ type: 'text', nullable: true })
  dueAt!: string | null;

  @Column({ type: 'text', nullable: true })
  closedAt!: string | null;

  @Column({ type: 'text' })
  createdAt!: string;

  @Column({ type: 'text' })
  updatedAt!: string;
}
