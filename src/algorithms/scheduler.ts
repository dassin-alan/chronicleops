import type { Dependency, Resource, ScheduleEntry, Task } from "../domain/types";
import { natural } from "../utils";
import { topologicalSort } from "./graph";

export interface ScheduleResult {
  status: "optimal" | "heuristic" | "infeasible";
  entries: ScheduleEntry[];
  makespan: number | null;
  totalTardiness: number | null;
  scheduledTaskIds: string[];
  unscheduledTaskIds: string[];
  visitedStates: number;
  computationTimeMs: number;
  heuristicReason?: string;
  infeasibleReasons: string[];
}

export interface SchedulerInput {
  tasks: Record<string, Task>;
  resources: Record<string, Resource>;
  dependencies: Dependency[];
  startDay?: number;
  fixedEntries?: ScheduleEntry[];
}

type Load = Map<string, Map<number, number>>;

const compareTasks = (a: Task, b: Task) =>
  b.priority - a.priority || (a.dueDay ?? Number.MAX_SAFE_INTEGER) - (b.dueDay ?? Number.MAX_SAFE_INTEGER) || natural(a.id, b.id);

const remaining = (task: Task) => Math.max(0, task.status === "completed" ? 0 : task.remainingDays);

function copyLoad(source: Load): Load {
  return new Map([...source].map(([resourceId, days]) => [resourceId, new Map(days)]));
}

function addEntry(load: Load, entry: ScheduleEntry): void {
  const days = load.get(entry.resourceId) ?? new Map<number, number>();
  for (const day of entry.workingDays) days.set(day, (days.get(day) ?? 0) + 1);
  load.set(entry.resourceId, days);
}

function earliestEntry(task: Task, resource: Resource, earliest: number, load: Load): ScheduleEntry | null {
  const count = remaining(task);
  if (count === 0) return null;
  const days = load.get(resource.id) ?? new Map<number, number>();
  for (let start = Math.max(0, earliest); start < 366; start += 1) {
    const workingDays: number[] = [];
    for (let day = start; day < 366 && workingDays.length < count; day += 1) {
      if (!resource.unavailableDays.includes(day) && (days.get(day) ?? 0) < resource.capacityPerDay) workingDays.push(day);
    }
    if (workingDays.length === count) {
      return { taskId: task.id, resourceId: resource.id, startDay: workingDays[0], endDay: workingDays[workingDays.length - 1], workingDays };
    }
  }
  return null;
}

function evaluate(entries: ScheduleEntry[], allTaskIds: string[], tasks: Record<string, Task>): Omit<ScheduleResult, "status" | "visitedStates" | "computationTimeMs" | "heuristicReason"> {
  const scheduledTaskIds = entries.map(entry => entry.taskId).sort(natural);
  const unscheduledTaskIds = allTaskIds.filter(id => !scheduledTaskIds.includes(id)).sort(natural);
  const makespan = entries.length ? Math.max(...entries.map(entry => entry.endDay + 1)) : null;
  const totalTardiness = entries.reduce((total, entry) => total + Math.max(0, entry.endDay - (tasks[entry.taskId].dueDay ?? entry.endDay)), 0);
  return { entries: entries.slice().sort((a, b) => natural(a.taskId, b.taskId)), makespan, totalTardiness, scheduledTaskIds, unscheduledTaskIds, infeasibleReasons: unscheduledTaskIds.map(id => `No feasible placement for ${id}`) };
}

function better(candidate: ReturnType<typeof evaluate>, incumbent: ReturnType<typeof evaluate> | undefined): boolean {
  if (!incumbent) return true;
  if (candidate.scheduledTaskIds.length !== incumbent.scheduledTaskIds.length) return candidate.scheduledTaskIds.length > incumbent.scheduledTaskIds.length;
  if ((candidate.makespan ?? Infinity) !== (incumbent.makespan ?? Infinity)) return (candidate.makespan ?? Infinity) < (incumbent.makespan ?? Infinity);
  if ((candidate.totalTardiness ?? Infinity) !== (incumbent.totalTardiness ?? Infinity)) return (candidate.totalTardiness ?? Infinity) < (incumbent.totalTardiness ?? Infinity);
  return candidate.entries.map(e => `${e.taskId}:${e.resourceId}`).join("|") < incumbent.entries.map(e => `${e.taskId}:${e.resourceId}`).join("|");
}

export function generateExactSchedule(input: SchedulerInput): ScheduleResult {
  const began = Date.now();
  const pending = Object.values(input.tasks).filter(task => remaining(task) > 0 && task.status !== "cancelled");
  const ids = pending.map(task => task.id);
  const dependencies = input.dependencies.filter(dep => ids.includes(dep.predecessorTaskId) && ids.includes(dep.successorTaskId));
  const topo = topologicalSort(ids, dependencies);
  if (topo.status === "cycle") return { status: "infeasible", ...evaluate([], ids, input.tasks), visitedStates: 0, computationTimeMs: Date.now() - began };

  const fixed = input.fixedEntries ?? [];
  const baseLoad: Load = new Map();
  fixed.forEach(entry => addEntry(baseLoad, entry));
  let best: ReturnType<typeof evaluate> | undefined;
  let visitedStates = 0;

  const search = (scheduled: ScheduleEntry[], skipped: Set<string>, load: Load): void => {
    visitedStates += 1;
    const remainingIds = ids.filter(id => !scheduled.some(entry => entry.taskId === id) && !skipped.has(id));
    if (!remainingIds.length) {
      const candidate = evaluate([...fixed, ...scheduled], ids, input.tasks);
      if (better(candidate, best)) best = candidate;
      return;
    }
    const ready = remainingIds.filter(id => dependencies.filter(dep => dep.successorTaskId === id).every(dep => scheduled.some(entry => entry.taskId === dep.predecessorTaskId) || skipped.has(dep.predecessorTaskId)));
    if (!ready.length) return;
    for (const id of ready.sort((a, b) => compareTasks(input.tasks[a], input.tasks[b]))) {
      const task = input.tasks[id];
      const predecessorEnd = Math.max(input.startDay ?? 0, ...dependencies.filter(dep => dep.successorTaskId === id).map(dep => (scheduled.find(entry => entry.taskId === dep.predecessorTaskId)?.endDay ?? -1) + 1));
      const resources = Object.values(input.resources).filter(resource => resource.active && resource.skills.includes(task.requiredSkill) && (!task.assignedResourceId || task.assignedResourceId === resource.id)).sort((a, b) => natural(a.id, b.id));
      for (const resource of resources) {
        const entry = earliestEntry(task, resource, predecessorEnd, load);
        if (!entry) continue;
        const nextLoad = copyLoad(load); addEntry(nextLoad, entry); search([...scheduled, entry], skipped, nextLoad);
      }
      const nextSkipped = new Set(skipped); nextSkipped.add(id); search(scheduled, nextSkipped, load);
    }
  };
  search([], new Set(), baseLoad);
  const result = best ?? evaluate(fixed, ids, input.tasks);
  return { status: result.unscheduledTaskIds.length ? "infeasible" : "optimal", ...result, visitedStates, computationTimeMs: Date.now() - began };
}

export function generateGreedySchedule(input: SchedulerInput): ScheduleResult {
  const began = Date.now();
  const tasks = Object.values(input.tasks).filter(task => remaining(task) > 0 && task.status !== "cancelled").sort(compareTasks);
  const load: Load = new Map(); const entries: ScheduleEntry[] = [...(input.fixedEntries ?? [])]; entries.forEach(entry => addEntry(load, entry));
  for (const task of tasks) {
    const predecessorEnd = Math.max(input.startDay ?? 0, ...input.dependencies.filter(dep => dep.successorTaskId === task.id).map(dep => (entries.find(entry => entry.taskId === dep.predecessorTaskId)?.endDay ?? -1) + 1));
    const options = Object.values(input.resources).filter(resource => resource.active && resource.skills.includes(task.requiredSkill)).sort((a, b) => natural(a.id, b.id)).map(resource => earliestEntry(task, resource, predecessorEnd, load)).filter((entry): entry is ScheduleEntry => entry !== null).sort((a, b) => a.endDay - b.endDay || natural(a.resourceId, b.resourceId));
    const chosen = options[0]; if (chosen) { entries.push(chosen); addEntry(load, chosen); }
  }
  const result = evaluate(entries, tasks.map(task => task.id), input.tasks);
  return { status: result.unscheduledTaskIds.length ? "infeasible" : "heuristic", ...result, visitedStates: tasks.length, computationTimeMs: Date.now() - began, heuristicReason: "Deterministic priority-first dispatch" };
}

export const generateHeuristicSchedule = generateGreedySchedule;
export const generateSchedule = (input: SchedulerInput): ScheduleResult => Object.values(input.tasks).filter(task => remaining(task) > 0 && task.status !== "cancelled").length <= 10 ? generateExactSchedule(input) : generateGreedySchedule(input);
