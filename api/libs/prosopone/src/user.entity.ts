import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

/**
 * A person, as a row.
 *
 * `@Unique` on the tenant and the email together, not on the email alone: two
 * organizations may each know the same person, and a global constraint would
 * let the first one to record an address stop the second from ever doing so —
 * while also telling them that somebody, somewhere, already had.
 */
@Entity('people')
@Unique('people_email_per_organization', ['organizationId', 'email'])
export class UserEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column()
  organizationId!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column()
  email!: string;

  @Column()
  phoneNumber!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /** The group they belong to, by id. */
  @Column({ type: 'text', nullable: true })
  groupId!: string | null;
}
