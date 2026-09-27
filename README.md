# ChronicleOps

Offline event-sourced project operations and constrained scheduling workbench. Run `npm install`, `npm run dev`, then open the Vite URL. Validation is `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`.

Core exports: `executeCommand` (`src/event-sourcing/commandBus.ts`), `replayEvents` (`src/event-sourcing/replay.ts`), `createInMemoryEventStore` (`src/event-sourcing/eventStore.ts`), `createSnapshot`/`restoreFromSnapshot` (`snapshots.ts`), graph and critical path (`src/algorithms`), schedule generators (`scheduler.ts`), `advanceSimulationDay` (`src/simulation/advanceDay.ts`), branch functions (`src/algorithms/branching.ts`), `validateChronicleOpsFile` (`src/validation/fileValidator.ts`), and `selectWorkspaceMetrics` (`src/state/selectors.ts`).

The event store enforces optimistic concurrency and command-id idempotency. Reducers are pure and snapshots are checksummed. Scheduling is exhaustive for 10 tasks or fewer and deterministic heuristic afterwards. The import validator accepts `unknown` and returns structured errors without throwing.

Known limitations: persistence is intentionally local/in-memory for fully offline operation; merge resolution UI exposes source/target/base choices while manual JSON resolution is an API-level capability.
