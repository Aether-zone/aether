import { IoMoonOutline, IoSunnyOutline } from 'react-icons/io5';

/**
 * Icons that are not nav entries.
 *
 * Ionicons 5 outline, the family kosmos itself draws with — see the note in
 * `app/(dashboard)/nav.tsx` for why the set is not a free choice.
 *
 * This file used to carry nine hand-drawn glyphs copied from loculus, of which
 * two were ever rendered; the other seven described an object store this app
 * does not have. They are gone rather than converted.
 */

/** The size kosmos's icon slots expect; a class beats react-icons' `1em`. */
const SIZE = 'size-4';

/**
 * `className` is appended rather than replacing the size, so a caller can say
 * *when* an icon shows without having to restate how big it is. The theme
 * toggle renders both of these and lets CSS choose — see the note there.
 */
export function SunIcon({ className = '' }: { className?: string }) {
  return <IoSunnyOutline className={`${SIZE} ${className}`} aria-hidden />;
}

export function MoonIcon({ className = '' }: { className?: string }) {
  return <IoMoonOutline className={`${SIZE} ${className}`} aria-hidden />;
}
