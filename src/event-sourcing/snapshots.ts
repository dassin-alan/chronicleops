import type { Snapshot, EventEnvelope, WorkspaceState } from "../domain/types";
import { checksum, clone } from "../utils";
import { replayEvents } from "./replay";
export const createSnapshot=(branchId:string,sequence:number,state:WorkspaceState):Snapshot=>({branchId,sequence,state:clone(state),checksum:checksum(state)});
export function restoreFromSnapshot(snapshot:Snapshot|undefined,events:EventEnvelope[]):WorkspaceState { if(snapshot&&snapshot.checksum===checksum(snapshot.state))return replayEvents(events.filter(e=>e.sequence>snapshot.sequence),clone(snapshot.state)); return replayEvents(events); }
