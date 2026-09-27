export type TaskStatus = "not-started" | "ready" | "in-progress" | "blocked" | "completed" | "cancelled";
export interface Task { id: string; title: string; description: string; durationDays: number; remainingDays: number; requiredSkill: string; priority: 1|2|3|4|5; dueDay: number|null; status: TaskStatus; assignedResourceId: string|null; progress: number; createdAtEventId: string; completedDay: number|null; }
export interface Resource { id: string; name: string; skills: string[]; capacityPerDay: number; unavailableDays: number[]; active: boolean; }
export interface Dependency { id: string; predecessorTaskId: string; successorTaskId: string; type: "finish-to-start"; }
export interface ScheduleEntry { taskId: string; resourceId: string; startDay: number; endDay: number; workingDays: number[]; }
export interface WorkspaceState { workspaceId: string; name: string; version: number; currentDay: number; tasks: Record<string,Task>; resources: Record<string,Resource>; dependencies: Dependency[]; schedules: ScheduleEntry[]; simulationStatus: "draft"|"planned"|"running"|"paused"|"completed"|"blocked"; }
export interface EventEnvelope<T = unknown> { eventId:string; sequence:number; workspaceId:string; branchId:string; type:string; timestamp:string; actor:"user"|"system"; commandId:string; payload:T; }
export type DomainEvent = EventEnvelope;
export interface Snapshot { branchId:string; sequence:number; state:WorkspaceState; checksum:string; }
export type Command = { commandId:string; expectedVersion:number; type:string; payload: Record<string, unknown> };
export interface CommandError { path:string; code:string; message:string; }
export interface CommandResult { success:boolean; events:EventEnvelope[]; errors:CommandError[]; version:number; }
export const emptyWorkspace = (workspaceId = "workspace", name = "ChronicleOps"): WorkspaceState => ({ workspaceId, name, version: 0, currentDay: 0, tasks: {}, resources: {}, dependencies: [], schedules: [], simulationStatus: "draft" });
