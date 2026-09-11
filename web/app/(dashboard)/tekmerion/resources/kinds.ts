import { type ResourceType } from '@aether/contract';
import {
  IoChatbubblesOutline,
  IoDocumentOutline,
  IoDocumentTextOutline,
  IoFilmOutline,
  IoGlobeOutline,
  IoMailOutline,
  IoMusicalNotesOutline,
  IoCreateOutline,
} from 'react-icons/io5';
import type { IconType } from 'react-icons';

/**
 * How each kind reads, and what it looks like.
 *
 * An icon per kind rather than a badge, because a resource list is scanned
 * rather than read: the kind is the first thing that tells you whether the row
 * is worth stopping at, and eight coloured words all the same shape do not
 * separate at a glance the way eight shapes do.
 */
export const KINDS: Record<ResourceType, { label: string; icon: IconType }> = {
  NOTE: { label: 'Note', icon: IoCreateOutline },
  DOCUMENT: { label: 'Document', icon: IoDocumentTextOutline },
  FILE: { label: 'File', icon: IoDocumentOutline },
  WEB_PAGE: { label: 'Web page', icon: IoGlobeOutline },
  EMAIL: { label: 'Email', icon: IoMailOutline },
  CONVERSATION: { label: 'Conversation', icon: IoChatbubblesOutline },
  AUDIO: { label: 'Audio', icon: IoMusicalNotesOutline },
  VIDEO: { label: 'Video', icon: IoFilmOutline },
};
