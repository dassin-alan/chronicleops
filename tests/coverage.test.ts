import { describe, expect, test } from "vitest";
import type { Dependency, EventEnvelope, Resource, Task } from "../src/domain/types";
import { emptyWorkspace } from "../src/domain/types";
import { calculateCriticalPath } from "../src/algorithms/criticalPath";
import { detectDependencyCycle, topologicalSort } from "../src/algorithms/graph";
import { generateExactSchedule, generateGreedySchedule, generateSchedule } from "../src/algorithms/scheduler";
import { applyIncrementalReplan } from "../src/algorithms/incrementalReplan";
import { diffBranches, mergeBranches } from "../src/algorithms/branching";
import { createInMemoryEventStore } from "../src/event-sourcing/eventStore";
import { createSnapshot, restoreFromSnapshot } from "../src/event-sourcing/snapshots";
import { reduceEvent } from "../src/event-sourcing/reducer";
import { validateChronicleOpsFile } from "../src/validation/fileValidator";

const task=(id:string,duration=2,skill="delivery"):Task=>({id,title:id,description:"",durationDays:duration,remainingDays:duration,requiredSkill:skill,priority:3,dueDay:10,status:"not-started",assignedResourceId:null,progress:0,createdAtEventId:"e",completedDay:null});
const resource=(id:string,skills=["delivery"]):Resource=>({id,name:id,skills,capacityPerDay:1,unavailableDays:[],active:true});
const dep=(predecessorTaskId:string,successorTaskId:string,id=`${predecessorTaskId}-${successorTaskId}`):Dependency=>({id,predecessorTaskId,successorTaskId,type:"finish-to-start"});
const event=(sequence:number,type:string,payload:unknown,branchId="main",commandId=`c${sequence}`):EventEnvelope=>({eventId:`e${branchId}${sequence}`,sequence,workspaceId:"w",branchId,type,timestamp:"1970-01-01T00:00:00.000Z",actor:"user",commandId,payload});
const file=(events:EventEnvelope[])=>({schemaVersion:"1.0",exportedAt:"1970",workspaceId:"w",activeBranchId:"main",branches:[{id:"main"}],events,snapshots:[],settings:{simulationSpeed:1,showCriticalPath:true,showSlack:true}});

describe("graph matrix",()=>{
 test.each([[[],0],[['task-1'],1],[['task-2','task-10'],2],[['a','b','c'],3]] as [string[],number][])('topologically orders %o',ids=>expect((topologicalSort(ids,[] ) as {order:string[]}).order).toHaveLength(ids.length));
 test.each([[2,3,5],[1,1,2],[4,1,5],[3,4,7],[5,5,10],[1,9,10],[8,2,10],[2,8,10],[6,6,12],[10,1,11]] as [number,number,number][])('critical path adds %i and %i',(a,b,total)=>{const tasks={a:task('a',a),b:task('b',b)};expect(calculateCriticalPath(tasks,[dep('a','b')]).projectDuration).toBe(total);});
 test.each([['a','b','c'],['task-1','task-2','task-3'],['x1','x2','x3'],['n-1','n-2','n-3'],['alpha','beta','gamma'],['one','two','three'],['q','w','e'],['r','s','t'],['k','l','m'],['red','blue','green']] as [string,string,string][])('detects a complete three node cycle', (a,b,c)=>{const path=detectDependencyCycle([a,b,c],[dep(a,b),dep(b,c),dep(c,a)])!;expect(path[0]).toBe(path.at(-1));expect(new Set(path.slice(0,-1))).toEqual(new Set([a,b,c]));});
});

describe("scheduler matrix",()=>{
 test.each([1,2,3,4,5,6,7,8,9,10])('optimally schedules a %i-day task',duration=>{const t=task('t',duration);const result=generateExactSchedule({tasks:{t},resources:{r:resource('r')},dependencies:[]});expect(result.status).toBe('optimal');expect(result.entries[0].workingDays).toHaveLength(duration);});
 test.each([0,1,2,3,4,5,6,7,8,9])('respects outage at day %i',outage=>{const r=resource('r');r.unavailableDays=[outage];const result=generateExactSchedule({tasks:{t:task('t',2)},resources:{r},dependencies:[]});expect(result.entries[0].workingDays).not.toContain(outage);});
 test.each([1,2,3,4,5,6,7,8,9,10,11,12])('uses heuristic above ten tasks (%i)',offset=>{const tasks=Object.fromEntries(Array.from({length:11},(_,i)=>[`task-${i+offset}`,task(`task-${i+offset}`,1)]));expect(generateSchedule({tasks,resources:{r:resource('r')},dependencies:[]}).status).toBe('heuristic');});
 test('does not schedule unmatched skills',()=>expect(generateExactSchedule({tasks:{t:task('t',1,'qa')},resources:{r:resource('r')},dependencies:[]}).unscheduledTaskIds).toEqual(['t']));
 test('honors dependencies',()=>{const result=generateExactSchedule({tasks:{a:task('a',2),b:task('b',2)},resources:{r:resource('r')},dependencies:[dep('a','b')]});expect(result.entries.find(e=>e.taskId==='b')!.startDay).toBeGreaterThan(result.entries.find(e=>e.taskId==='a')!.endDay);});
 test('greedy and exact produce valid results',()=>{const input={tasks:{a:task('a'),b:task('b')},resources:{r:resource('r')},dependencies:[]};expect(generateGreedySchedule(input).entries).toHaveLength(2);expect(generateExactSchedule(input).visitedStates).toBeGreaterThan(0);});
});

describe("store snapshots and validator",()=>{
 test.each([1,2,3,4,5,6,7,8,9,10])('snapshots restore task event %i',n=>{const state=reduceEvent(emptyWorkspace('w'),event(n,'TaskCreated',{task:task(`t${n}`)}));const snapshot=createSnapshot('main',n,state);expect(restoreFromSnapshot(snapshot,[]).tasks[`t${n}`].id).toBe(`t${n}`);});
 test.each([null,undefined,1,'x',[],{}, {schemaVersion:'x'}])('validator never throws for invalid input',input=>expect(validateChronicleOpsFile(input).success).toBe(false));
 test.each([1.5,-1,NaN,Infinity,2.2,3.3,4.4,5.5,6.6,7.7])('validator rejects invalid sequences %p',sequence=>{const result=validateChronicleOpsFile(file([event(sequence,'WorkspaceCreated',{workspaceId:'w',name:'w'})]));expect(result.success).toBe(false);});
 test('validator accepts a minimal well formed stream',()=>expect(validateChronicleOpsFile(file([event(1,'WorkspaceCreated',{workspaceId:'w',name:'w'})])).success).toBe(true));
 test('validator rejects duplicate command ids',()=>expect(validateChronicleOpsFile(file([event(1,'WorkspaceCreated',{},'main','same'),event(2,'WorkspaceCreated',{},'main','same')])).success).toBe(false));
 test('snapshot corruption falls back',()=>{const state=emptyWorkspace('w');const snapshot=createSnapshot('main',0,state);snapshot.checksum='bad';expect(restoreFromSnapshot(snapshot,[event(1,'WorkspaceCreated',{workspaceId:'w',name:'changed'})]).name).toBe('changed');});
 test('command idempotency returns original append',()=>{const store=createInMemoryEventStore();const first=store.append([event(1,'WorkspaceCreated',{workspaceId:'w',name:'w'},'main','same')],0);const second=store.append([event(1,'WorkspaceCreated',{workspaceId:'w',name:'w'},'main','same')],999);expect(second).toEqual(first);expect(store.getVersion('main')).toBe(1);});
});

describe("incremental and merge",()=>{
 test.each([1,2,3,4,5,6,7,8,9,10])('replan includes changed task and descendant %i',n=>{const state=emptyWorkspace('w');state.tasks={a:task('a'),b:task('b')};state.resources={r:resource('r')};state.dependencies=[dep('a','b')];state.currentDay=n;const result=applyIncrementalReplan(state,['a'],'delay');expect(result.affectedTaskIds).toEqual(['a','b']);});
 test('diff identifies changed title',()=>{const base=emptyWorkspace('w');base.tasks={t:task('t')};const target=structuredClone(base);target.tasks.t.title='changed';expect(diffBranches(base,base,target).changedTaskFields.some(change=>change.field==='title')).toBe(true);});
 test('merges different task fields',()=>{const base=emptyWorkspace('w');base.tasks={t:task('t')};const source=structuredClone(base),target=structuredClone(base);source.tasks.t.title='source';target.tasks.t.durationDays=4;expect(mergeBranches(base,source,target).status).toBe('merged');});
 test('conflicts on same task field',()=>{const base=emptyWorkspace('w');base.tasks={t:task('t')};const source=structuredClone(base),target=structuredClone(base);source.tasks.t.durationDays=3;target.tasks.t.durationDays=4;expect(mergeBranches(base,source,target).status).toBe('conflicts');});
 test('rejects merge-created cycles',()=>{const base=emptyWorkspace('w');base.tasks={a:task('a'),b:task('b')};const source=structuredClone(base),target=structuredClone(base);source.dependencies=[dep('a','b')];target.dependencies=[dep('b','a')];expect(mergeBranches(base,source,target).status).toBe('conflicts');});
});
