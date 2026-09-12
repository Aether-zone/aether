import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * A place, as a row.
 *
 * No uniqueness rule, unlike people. Two rooms may both be called "Meeting
 * Room" and two places may share an address; nothing here is a natural key
 * except the id.
 *
 * `lat`/`lng` are `real`, not text: they are the one thing in aether anybody
 * will want to compare or sort by, and a string sorts "9" after "10".
 */
@Entity('places')
export class PlaceEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column()
  organizationId!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column()
  address!: string;

  @Column({ type: 'real' })
  lat!: number;

  @Column({ type: 'real' })
  lng!: number;

  /**
   * When the row was written — an ordering key, not part of `PlaceDTO`.
   *
   * A place carries no timestamps in the contract, and it used to be listed in
   * the order an array happened to hold it. A uuid primary key gives no such
   * order, so without this the list would reshuffle whenever SQLite felt like
   * it — and an edit would move a row, which is exactly what makes a console
   * jump under the reader.
   *
   * Two places written in the same millisecond tie; `id` breaks it, so the
   * order is arbitrary between them but never changes.
   */
  @Column({ type: 'text' })
  recordedAt!: string;
}
