# Technical documentation

## Architecture

```
 phones (thousands)          host screen (stream / TV)
        │  WebSocket /ws            │
        └──────────────┬────────────┘
                       ▼
        ┌────────────────────────────────┐
        │ dot-arena  (Render web service) │
        │  server.js   rooms in memory    │
        │  /healthz  /metrics  JSON logs  │
        └──────────────┬─────────────────┘
                       │ host presses "방송 리캡 만들기"
                       │ startTask("dot-arena-recap/sessionRecap", [session])
                       ▼
        ┌────────────────────────────────┐
        │ dot-arena-recap (Render Workflow)│
        │  sessionRecap ──┬─ analyzeRound │  one run per round, in parallel
        │                 ├─ analyzeRound │
        │                 └─ analyzeRound │
        │  → headlines + 1080×1920 SVG     │
        └────────────────────────────────┘
```

- **Game server:** Node 22 with only `ws` as a dependency. A room is a state machine: lobby → question → result. Bot answers are filled in at round start. A round closes when its timer ends or when everyone has answered.
- **Messages:** Phase changes (start/end) go to every socket, each with that player's own score, rank, partner and last result. Between phase changes only host screens get updates, throttled to about 3 per second. Ranks are computed once per broadcast (O(n log n)), not per player.
- **Recap:** `src/recap.js` holds pure functions. The workflow and the in-process fallback both use them, so the output is the same either way. The session payload holds no tokens or ids, only nicknames, scores and per-round summaries.

## Why Render Workflows here

The recap runs after the live show, outside the latency-critical path. Each round's analysis is independent, so `sessionRecap` fans out `analyzeRound` runs with `ctx.run` and awaits them together. Retries are set per task (2 retries, exponential backoff). The game server only triggers the run and waits for the result, so a slow or failed recap never blocks a live room. If the workflow fails, the server logs `recap.workflow_failed` and builds the card in-process.

Next steps on the same workflow: an LLM-written video script from the headlines, and archiving cards to object storage.

## Scaling

| Load | Plan |
|---|---|
| Up to ~5K concurrent players | One instance. Measured locally: 5,000 WebSocket players, round result p99 185 ms, heap 56 MB. |
| One room above one instance | Shard by room code. Each room lives on exactly one instance, and Render Key Value pub/sub fans broadcasts out to the sockets on other instances. Not built yet. |
| Many rooms | Horizontal autoscaling on CPU. Sticky routing by room code. |

The `MAX_ROOMS` (env) and 5,000-players-per-room limits protect one instance from overload.

## DevOps

| Area | What is in place |
|---|---|
| **CI/CD** | GitHub Actions runs `npm test` (9 tests) and a 500-player load smoke test on every push. Render's `autoDeployTrigger: checksPass` deploys only green commits. |
| **Health** | `/healthz` returns version (git commit), room count and uptime. It is wired as Render's health check, so a broken build is not promoted. |
| **Monitoring** | `/metrics` (Prometheus text) exposes rooms, players, sockets, joins, rounds, messages, dropped messages, event-loop lag p99 and heap. Structured JSON logs go to Render's log stream (`room.create`, `round.start`, `round.end`, `recap.*`). |
| **Resilience** | Rate limit of 10 messages/s per socket (token bucket). Max WebSocket payload 1 KB. Ping/pong drops dead sockets every 30 s. Idle rooms expire after 3 h. On SIGTERM the server tells clients to reconnect, and clients reconnect with backoff. Players rejoin with a per-player token, so a refresh keeps the score. |
| **Load testing** | `npm run load -- <url> <players>` opens real WebSocket players, plays a round and reports join, ack and result latency. |
| **Rollback** | Render one-click rollback to the previous deploy. Rooms are in memory, so deploy between live shows, not during one. |
| **Security** | No accounts, passwords or personal data beyond a nickname. Nicknames are stripped of control characters and `<>`, and all output is escaped. Host commands need a per-room secret host key. Answers are validated server-side per game. |

## Known gaps

- Rooms are in memory. A restart during a live show ends that room. Snapshotting to Key Value is the fix.
- The 5K figure is from a laptop. Render Starter has less CPU, so re-run `scripts/load.js` against the deployed URL before a promoted show.
- No anti-multi-tab protection yet beyond rate limits.
