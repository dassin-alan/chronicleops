# ChronicleOps Architecture

ChronicleOps uses an append-only in-memory event store as its source of truth. A pure reducer replays immutable envelopes into a workspace projection. Commands validate against the projection, append atomically with optimistic versions, and are idempotent by command ID. Snapshots are checksummed projections every 50 events.

The graph, critical-path, scheduler, simulation, branch/diff/merge, validator, and metrics modules are framework independent. React is an operational shell over a `ChronicleEngine`, so its state is never a second domain authority.
