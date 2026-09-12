import { type GroupType } from '@aether/contract';
import {
  IoBriefcaseOutline,
  IoBusinessOutline,
  IoEllipsisHorizontalOutline,
  IoHeartOutline,
  IoPeopleCircleOutline,
  IoRibbonOutline,
} from 'react-icons/io5';
import type { IconType } from 'react-icons';

/**
 * How each kind reads, and what it looks like.
 *
 * An icon per kind, because this list is scanned rather than read: what
 * separates a client from a hobby at a glance is a shape, not a word in the
 * same weight as every other word on the row.
 */
export const TYPES: Record<GroupType, { label: string; icon: IconType }> = {
  COMPANY: { label: 'Company', icon: IoBusinessOutline },
  COMMUNITY: { label: 'Community', icon: IoPeopleCircleOutline },
  ASSOCIATION: { label: 'Association', icon: IoRibbonOutline },
  TEAM: { label: 'Team', icon: IoBriefcaseOutline },
  FAMILY: { label: 'Family', icon: IoHeartOutline },
  OTHER: { label: 'Other', icon: IoEllipsisHorizontalOutline },
};

/**
 * What to show for a group whose kind nobody set.
 *
 * Not folded into `OTHER`. "Other" is a choice somebody made — this group is
 * none of the five — where an absent type is a question nobody has answered
 * yet, and a list that showed them identically would lose the difference.
 */
export const UNSTATED = {
  label: 'Unstated',
  icon: IoEllipsisHorizontalOutline,
};
