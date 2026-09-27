import type { Dependency, ScheduleEntry, WorkspaceState } from "../domain/types";
import { generateSchedule } from "./scheduler";
import { calculateCriticalPath } from "./criticalPath";

export interface IncrementalReplanResult { previousSchedule: ScheduleEntry[]; nextSchedule: ScheduleEntry[]; affectedTaskIds: string[]; unchangedTaskIds: string[]; changedEntryIds: string[]; criticalPathChanged: boolean; reason: string; computationTimeMs: number; }

function descendants(taskId: string, dependencies: Dependency[]): string[] {
  const found = new Set([taskId]); const queue = [taskId];
  while (queue.length) { const current = queue.shift()!; for (const dep of dependencies.filter(item => item.predecessorTaskId === current)) if (!found.has(dep.successorTaskId)) { found.add(dep.successorTaskId); queue.push(dep.successorTaskId); } }
  return [...found].sort();
}

export function applyIncrementalReplan(state: WorkspaceState, changedTaskIds: string[], reason: string): IncrementalReplanResult {
  const began = Date.now();
  const affected = new Set(changedTaskIds.flatMap(id => descendants(id, state.dependencies)));
  const affectedResources = new Set(state.schedules.filter(entry => affected.has(entry.taskId)).map(entry => entry.resourceId));
  state.schedules.filter(entry => affectedResources.has(entry.resourceId) && entry.startDay >= state.currentDay).forEach(entry => affected.add(entry.taskId));
  const affectedTaskIds = [...affected].sort();
  const unchanged = state.schedules.filter(entry => !affected.has(entry.taskId) || entry.endDay < state.currentDay);
  const previousCritical = calculateCriticalPath(state.tasks, state.dependencies, true).criticalTaskIds.join("|");
  const taskSubset = Object.fromEntries(Object.entries(state.tasks).filter(([id]) => affected.has(id)));
  const dependencies = state.dependencies.filter(dep => affected.has(dep.predecessorTaskId) && affected.has(dep.successorTaskId));
  const schedule = generateSchedule({ tasks: taskSubset, resources: state.resources, dependencies, startDay: state.currentDay, fixedEntries: unchanged });
  const nextSchedule = [...unchanged, ...schedule.entries.filter(entry => affected.has(entry.taskId))];
  const changedEntryIds = affectedTaskIds.filter(id => JSON.stringify(state.schedules.find(entry => entry.taskId === id)) !== JSON.stringify(nextSchedule.find(entry => entry.taskId === id)));
  const nextCritical = calculateCriticalPath(state.tasks, state.dependencies, true).criticalTaskIds.join("|");
  return { previousSchedule: state.schedules, nextSchedule, affectedTaskIds, unchangedTaskIds: Object.keys(state.tasks).filter(id => !affected.has(id)).sort(), changedEntryIds, criticalPathChanged: previousCritical !== nextCritical, reason, computationTimeMs: Date.now() - began };
}
