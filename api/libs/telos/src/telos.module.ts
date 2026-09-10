import { Module } from '@nestjs/common';

import { GoalController } from './goal.controller';
import { GoalService } from './goal.service';
import { IdeaController } from './idea.controller';
import { IdeaService } from './idea.service';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

/**
 * Telos — purpose, from the spark to the next thing to do.
 *
 * The chain is deliberate: an idea becomes a goal, a goal is pursued by a
 * project, a project is done through tasks. Each names the one above it, which
 * is why `IdeaStatus` has a `PROMOTED` — the state that says this one made it
 * out of the pile.
 *
 * All four steps exist. Two of the three links between them do:
 *
 * | link | held by | the other end |
 * | --- | --- | --- |
 * | idea → goal | `Goal.inspiredBy` | derived at `IdeaController` |
 * | goal → project | *nothing yet* | — |
 * | project → task | `Task.projectId` | `TaskService.idsInProject` |
 *
 * Each is stored on exactly one end and read back from there, so the two
 * directions can never disagree. Which goal a project pursues is the link
 * still missing, and belongs on the project when it is added.
 *
 * The dependencies run one way — `GoalService` → `IdeaService`,
 * `TaskService` → `ProjectService` — so the owning end can refuse a reference
 * to something that does not exist. Controllers compose the reverse: were the
 * services to ask each other, neither could be constructed.
 */
@Module({
  controllers: [
    IdeaController,
    GoalController,
    ProjectController,
    TaskController,
  ],
  providers: [IdeaService, GoalService, ProjectService, TaskService],
  exports: [IdeaService, GoalService, ProjectService, TaskService],
})
export class TelosModule {}
