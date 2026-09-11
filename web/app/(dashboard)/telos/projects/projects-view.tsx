'use client';

import { Button, EmptyState, Text } from '@aether-zone/kosmos';
import type { GoalDTO, ProjectDTO, UserDTO } from '@aether/contract';
import { useState } from 'react';
import { IoAddOutline } from 'react-icons/io5';

import { NewProjectDialog } from './new-project-dialog';
import { ProjectCard } from './project-card';

/**
 * The projects board.
 *
 * One grid rather than the goals page's status sections, and the difference is
 * how many there are of each. A person runs a handful of projects at a time
 * and every one of them is a live question — where goals accumulate, and the
 * parked ones need separating from the live ones before the page is readable.
 * Grouping four cards under four headings would be filing, not helping.
 */
export function ProjectsView({
  projects,
  goals,
  people,
}: {
  projects: ProjectDTO[];
  goals: GoalDTO[];
  people: UserDTO[];
}) {
  const [starting, setStarting] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setStarting(true)}>
          <IoAddOutline className="size-4" aria-hidden />
          New project
        </Button>
      </div>

      <NewProjectDialog
        people={people}
        open={starting}
        onOpenChange={setStarting}
      />

      {projects.length === 0 ? (
        <EmptyState
          title="Nothing under way"
          description="A project is where a goal turns into work with a beginning and an end. Start one from a goal, or here."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              goals={goals}
              people={people}
            />
          ))}
        </ul>
      )}

      <Text tone="muted" size="body-small">
        {projects.length === 1 ? '1 project' : `${projects.length} projects`}
      </Text>
    </div>
  );
}
