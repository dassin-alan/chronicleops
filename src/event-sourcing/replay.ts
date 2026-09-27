import type { EventEnvelope, WorkspaceState } from "../domain/types";
import { emptyWorkspace } from "../domain/types";
import { reduceEvent } from "./reducer";
export const replayEvents=(events:readonly EventEnvelope[], initial:WorkspaceState=emptyWorkspace()):WorkspaceState=>events.slice().sort((a,b)=>a.sequence-b.sequence).reduce(reduceEvent,initial);
