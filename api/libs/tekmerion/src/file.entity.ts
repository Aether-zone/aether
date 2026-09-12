import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { type FileStatus } from '@aether/contract';

/**
 * A stored object, recorded here so the rest of aether references a file by id
 * and never has to know about keys.
 *
 * Named `StoredFile` rather than `File`: `File` is a global in Node's type
 * definitions, and an entity that silently shadows it makes for confusing
 * errors.
 *
 * The bytes live in loculus. aether holds no bucket credentials and signs
 * nothing — it asks loculus where a file may go, and for a URL to read one
 * back.
 */
@Entity('files')
export class StoredFile {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column()
  organizationId!: string;

  /**
   * The object key loculus gave out. Unique, because it is generated per
   * upload — two rows sharing one would mean two resources pointing at bytes
   * only one of them owns.
   */
  @Index({ unique: true })
  @Column()
  key!: string;

  /**
   * Which store holds it. Always `loculus` today; written per file so an
   * existing row stays resolvable if a second store is ever added.
   */
  @Column()
  backend!: string;

  /** The name the file was uploaded under. Never used to build the key. */
  @Column()
  originalName!: string;

  @Column()
  mimeType!: string;

  /** Size in bytes, as the browser reported it when asking for a URL. */
  @Column({ type: 'integer' })
  size!: number;

  /*
   * `type: 'text'` because the field's type is a union of string literals, and
   * `emitDecoratorMetadata` emits `Object` for any union — TypeORM would have
   * nothing to infer from.
   */
  @Column({ type: 'text' })
  status!: FileStatus;

  @Column({ type: 'text' })
  createdAt!: string;

  @Column({ type: 'text' })
  updatedAt!: string;
}
