import type { EventEnvelope, WorkspaceState, Task, Resource, Dependency, ScheduleEntry } from "../domain/types";
import { clone, natural } from "../utils";
export function reduceEvent(state:WorkspaceState, event:EventEnvelope):WorkspaceState {
  const next=clone(state); const p=event.payload as Record<string, unknown>;
  switch(event.type) {
    case "WorkspaceCreated": return { ...next, workspaceId:String(p.workspaceId), name:String(p.name) };
    case "TaskCreated": next.tasks[(p.task as Task).id]=clone(p.task as Task); break;
    case "TaskUpdated": Object.assign(next.tasks[String(p.taskId)] ?? {}, p.changes); break;
    case "TaskDeleted": { const taskId=String(p.taskId); delete next.tasks[taskId]; next.dependencies=next.dependencies.filter(d=>d.predecessorTaskId!==taskId&&d.successorTaskId!==taskId); next.schedules=next.schedules.filter(s=>s.taskId!==taskId); break; }
    case "ResourceCreated": next.resources[(p.resource as Resource).id]=clone(p.resource as Resource); break;
    case "ResourceUpdated": Object.assign(next.resources[String(p.resourceId)] ?? {}, p.changes); break;
    case "ResourceDeleted": { const resourceId=String(p.resourceId); delete next.resources[resourceId]; Object.values(next.tasks).forEach(t=>{if(t.assignedResourceId===resourceId)t.assignedResourceId=null;}); next.schedules=next.schedules.filter(s=>s.resourceId!==resourceId); break; }
    case "DependencyAdded": next.dependencies.push(clone(p.dependency as Dependency)); break;
    case "DependencyRemoved": next.dependencies=next.dependencies.filter(d=>d.id!==String(p.dependencyId)); break;
    case "ScheduleGenerated": case "ReplanCompleted": next.schedules=clone(p.entries as ScheduleEntry[]); next.simulationStatus="planned"; break;
    case "SimulationStarted": next.simulationStatus="running"; break;
    case "SimulationPaused": next.simulationStatus="paused"; break;
    case "DayAdvanced": next.currentDay=Number(p.day); break;
    case "TaskStarted": { const t=next.tasks[String(p.taskId)]; if(t)t.status="in-progress"; break; }
    case "TaskProgressed": { const t=next.tasks[String(p.taskId)]; if(t){t.remainingDays=Number(p.remainingDays);t.progress=Number(p.progress);} break; }
    case "TaskCompleted": {const t=next.tasks[String(p.taskId)];if(t){t.status="completed";t.remainingDays=0;t.progress=100;t.completedDay=Number(p.day);}break;}
    case "TaskBlocked": {const t=next.tasks[String(p.taskId)];if(t)t.status="blocked";break;}
    case "ResourceOutageAdded": {const r=next.resources[String(p.resourceId)];if(r)r.unavailableDays=[...new Set([...r.unavailableDays,...(p.days as number[])])].sort((a,b)=>a-b);break;}
    case "TaskDelayApplied": {const t=next.tasks[String(p.taskId)];if(t)t.remainingDays+=Number(p.days);break;}
  }
  next.version=event.sequence; next.dependencies.sort((a,b)=>natural(a.id,b.id)); return next;
}
