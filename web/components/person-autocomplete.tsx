'use client';

import { Autocomplete, Text } from '@aether-zone/kosmos';
import type { UserDTO } from '@aether/contract';
import { useState } from 'react';
import { IoCloseOutline, IoPersonOutline } from 'react-icons/io5';

import { fullName } from '@/lib/person-display';

/**
 * Picking the people a record is about, by typing their name.
 *
 * kosmos's `Autocomplete` chooses one thing, so this wraps it: type, pick,
 * and the person becomes a chip while the field empties for the next one.
 * That is the shape a multi-select wants here — the answer is usually one or
 * two people out of a list that will not stay short, and a checkbox list stops
 * being readable at about a dozen while an autocomplete does not care.
 *
 * Someone already chosen is **removed from the options**, rather than shown
 * and ignored. An option that does nothing when picked is the kind of thing
 * people click twice and then distrust.
 */
export function PersonAutocomplete({
  id,
  people,
  selected,
  onChange,
  disabled,
}: {
  id?: string;
  /** Everyone who could be chosen. */
  people: UserDTO[];
  /** Ids, in the order they were added. */
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');

  const byId = new Map(people.map((person) => [person.id, person]));

  const options = people
    .filter((person) => !selected.includes(person.id))
    .map((person) => ({ value: person.id, label: fullName(person) }));

  if (people.length === 0) {
    return (
      <Text tone="muted" size="body-small">
        Nobody to choose from yet — people are added in Prosopone.
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Autocomplete
        id={id}
        options={options}
        value={query}
        onValueChange={setQuery}
        onSelect={(option) => {
          onChange([...selected, option.value]);

          // Emptied so the next name can be typed straight away; leaving the
          // chosen name behind would look like the field still held it.
          setQuery('');
        }}
        disabled={disabled}
        placeholder={selected.length === 0 ? 'Type a name…' : 'Add another…'}
        emptyMessage={
          options.length === 0 ? 'Everyone is already here.' : 'No such person.'
        }
      />

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((personId) => {
            const person = byId.get(personId);

            return (
              <span
                key={personId}
                className="inline-flex items-center gap-2 rounded-md border border-border py-1 pl-3 pr-1 text-sm text-foreground"
              >
                <IoPersonOutline
                  className="size-4 text-destructive"
                  aria-hidden
                />
                {/* An id with no person behind it is someone removed from
                    prosopone since. Naming it rather than dropping it, because
                    this is the editor: the reader is the one who can fix it. */}
                {person ? fullName(person) : 'Someone no longer here'}
                <button
                  type="button"
                  aria-label={`Remove ${person ? fullName(person) : 'this person'}`}
                  disabled={disabled}
                  onClick={() =>
                    onChange(selected.filter((other) => other !== personId))
                  }
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <IoCloseOutline className="size-4" aria-hidden />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
