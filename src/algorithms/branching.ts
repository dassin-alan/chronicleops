import type { Dependency, Resource, Task, WorkspaceState } from "../domain/types";
import { clone, natural } from "../utils";
import { detectDependencyCycle } from "./graph";

export interface FieldChange { entityType: "task" | "resource"; entityId: string; field: string; oldValue: unknown; newValue: unknown; }
export interface BranchDiff { baseSequence: number; addedTasks: string[]; deletedTasks: string[]; changedTaskFields: FieldChange[]; addedDependencies: string[]; removedDependencies: string[]; changedResources: FieldChange[]; scheduleChanges: { taskId: string; source: unknown; target: unknown }[]; }
export interface MergeConflict { id: string; entityType: "task" | "resource" | "dependency"; entityId: string; field: string; baseValue: unknown; sourceValue: unknown; targetValue: unknown; code: string; }
export interface MergeResult { status: "merged" | "conflicts"; mergedState?: WorkspaceState; mergedEvents: []; conflicts: MergeConflict[]; baseSequence: number; }

const fields = (base: Record<string, unknown> | undefined, next: Record<string, unknown> | undefined, entityType: "task" | "resource"): FieldChange[] => {
  if (!base || !next) return []; return Object.keys({ ...base, ...next }).filter(field => JSON.stringify(base[field]) !== JSON.stringify(next[field])).map(field => ({ entityType, entityId: String(next.id ?? base.id), field, oldValue: base[field], newValue: next[field] }));
};

export function diffBranches(base: WorkspaceState, source: WorkspaceState, target: WorkspaceState, baseSequence = base.version): BranchDiff {
  const sourceTaskIds = Object.keys(source.tasks), targetTaskIds = Object.keys(target.tasks), baseTaskIds = Object.keys(base.tasks);
  const changedTaskFields = targetTaskIds.filter(id => base.tasks[id] && target.tasks[id]).flatMap(id => fields(base.tasks[id] as unknown as Record<string, unknown>, target.tasks[id] as unknown as Record<string, unknown>, "task"));
  const changedResources = Object.keys(target.resources).filter(id => base.resources[id] && target.resources[id]).flatMap(id => fields(base.resources[id] as unknown as Record<string, unknown>, target.resources[id] as unknown as Record<string, unknown>, "resource"));
  const baseDeps = new Set(base.dependencies.map(dep => dep.id)), targetDeps = new Set(target.dependencies.map(dep => dep.id));
  return { baseSequence, addedTasks: targetTaskIds.filter(id => !baseTaskIds.includes(id)).sort(natural), deletedTasks: baseTaskIds.filter(id => !targetTaskIds.includes(id)).sort(natural), changedTaskFields, addedDependencies: [...targetDeps].filter(id => !baseDeps.has(id)).sort(natural), removedDependencies: [...baseDeps].filter(id => !targetDeps.has(id)).sort(natural), changedResources, scheduleChanges: [...new Set([...sourceTaskIds, ...targetTaskIds])].filter(id => JSON.stringify(source.schedules.find(e => e.taskId === id)) !== JSON.stringify(target.schedules.find(e => e.taskId === id))).map(taskId => ({ taskId, source: source.schedules.find(e => e.taskId === taskId), target: target.schedules.find(e => e.taskId === taskId) })) };
}

function mergeEntities<T extends { id: string }>(base: Record<string, T>, source: Record<string, T>, target: Record<string, T>, type: "task" | "resource", conflicts: MergeConflict[]): Record<string, T> {
  const output = clone(target); for (const id of new Set([...Object.keys(base), ...Object.keys(source), ...Object.keys(target)])) { const b = base[id], s = source[id], t = target[id]; if (!b && s) { output[id] = clone(s); continue; } if (b && !s && t && JSON.stringify(t) !== JSON.stringify(b)) { conflicts.push({ id: `conflict-${type}-${id}`, entityType: type, entityId: id, field: "*", baseValue: b, sourceValue: undefined, targetValue: t, code: "DELETE_MODIFY" }); continue; } if (!s) { delete output[id]; continue; } if (!t) { output[id] = clone(s); continue; } const merged = clone(t); for (const field of Object.keys(s) as (keyof T)[]) { const sourceChanged = JSON.stringify(s[field]) !== JSON.stringify(b?.[field]); const targetChanged = JSON.stringify(t[field]) !== JSON.stringify(b?.[field]); if (sourceChanged && targetChanged && JSON.stringify(s[field]) !== JSON.stringify(t[field])) conflicts.push({ id: `conflict-${type}-${id}-${String(field)}`, entityType: type, entityId: id, field: String(field), baseValue: b?.[field], sourceValue: s[field], targetValue: t[field], code: "FIELD_CONFLICT" }); else if (sourceChanged) merged[field] = clone(s[field]); } output[id] = merged; } return output;
}

export function mergeBranches(base: WorkspaceState, source: WorkspaceState, target: WorkspaceState): MergeResult {
  const conflicts: MergeConflict[] = []; const tasks = mergeEntities(base.tasks, source.tasks, target.tasks, "task", conflicts); const resources = mergeEntities(base.resources, source.resources, target.resources, "resource", conflicts);
  const dependencies: Dependency[] = [...target.dependencies]; for (const dep of source.dependencies) if (!dependencies.some(item => item.id === dep.id)) dependencies.push(clone(dep));
  const cycle = detectDependencyCycle(Object.keys(tasks), dependencies); if (cycle) conflicts.push({ id: "conflict-dependency-cycle", entityType: "dependency", entityId: cycle.join("-"), field: "graph", baseValue: base.dependencies, sourceValue: source.dependencies, targetValue: target.dependencies, code: "MERGE_CYCLE" });
  if (conflicts.length) return { status: "conflicts", mergedEvents: [], conflicts, baseSequence: base.version };
  return { status: "merged", mergedEvents: [], conflicts: [], baseSequence: base.version, mergedState: { ...clone(target), tasks: tasks as Record<string, Task>, resources: resources as Record<string, Resource>, dependencies } };
}
