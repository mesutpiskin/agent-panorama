# AgentPanorama — Implementation Plan

> Technical blueprint derived from `SPECIFICATION.md`.

## 1. Technology Stack

### 1.1 Stack Summary

| Layer | Technology | Version | Rationale |
|---|---|---:|---|
| Language | TypeScript | 5.9.3 | Native VS Code extension ecosystem, strict contracts for adapters and events; compatible with the typed linting toolchain. |
| Runtime | VS Code extension host | `^1.139.0` | Supports current and previous stable minor at implementation time. |
| Build | esbuild | 0.28.2 | Fast dual bundling for extension and webview with small release artifacts. |
| Validation | Zod | 4.6.5 | Runtime validation at every provider and HTTP boundary. |
| Persistence | `@vscode/sqlite3` | 5.1.14-vscode | Durable indexed event history using a VS Code-maintained SQLite build. |
| Unit testing | Vitest | 5.0.3 | Fast TypeScript tests with coverage and deterministic fake timers. |
| Property testing | fast-check | 4.10.2 | Verifies reducer and deduplication invariants over event sequences. |
| Extension testing | `@vscode/test-electron` | 3.1.0 | Official integration-test runner against real VS Code. |
| Linting | ESLint | 10.12.0 | Flat configuration and type-aware rules. |
| Packaging | `@vscode/vsce` | 4.0.0 | Official Marketplace/VSIX packaging path. |
| CI/CD | GitHub Actions | hosted | Native repository integration and cross-platform matrix builds. |

Versions were verified against npm on 2026-10-06. Production dependencies stay deliberately small.

### 1.2 Key Decisions

#### Decision: One extension package with an elected monitor host

- **Context:** Cross-window monitoring is required without a separately installed daemon (SPEC §3.1, §9).
- **Options:** separate daemon; independent per-window stores; elected extension host with loopback IPC.
- **Choice:** One extension host acquires an exclusive lease file and owns the database/API; other windows connect over authenticated loopback HTTP/SSE.
- **Rationale:** It produces one Marketplace install while preventing port and writer conflicts.
- **Consequences:** Leadership must recover from stale locks and extension-host crashes. Clients must tolerate brief reconnection gaps.

#### Decision: Atomic local event journal plus session projection

- **Context:** History must survive restarts and support 100,000 events without blocking (SPEC §3.2, §10).
- **Options:** VS Code globalState; JSONL; SQLite.
- **Choice:** A versioned, permission-restricted JSON event journal under VS Code global storage, written by atomic replacement.
- **Rationale:** It avoids native binary packaging failures while keeping all data local and recoverable. Bounded retention keeps the v1 data set manageable.
- **Consequences:** Queries are in-memory and v1 targets 100,000 bounded events. A future SQLite migration remains possible behind the store port.

#### Decision: Provider-neutral event contract with capability declarations

- **Context:** Providers expose very different observability surfaces (SPEC §3.3–§3.7).
- **Choice:** Adapters publish the same versioned envelope and declare exact/inferred capabilities.
- **Rationale:** The UI can remain truthful and provider-neutral instead of assuming every source has usage, tools, or waiting states.
- **Consequences:** Unknown fields are discarded at boundaries; contract changes require explicit schema versioning.

#### Decision: Supported APIs only for Copilot

- **Context:** VS Code extension isolation makes private Copilot state unreliable and unsafe to inspect (SPEC §3.6, §11).
- **Choice:** Detect the official extension and consume only public VS Code/Copilot surfaces. If no session telemetry is exposed, show capability availability rather than invented sessions.
- **Consequences:** Copilot support can be less detailed than Claude or LiteLLM, but Marketplace review and user privacy remain defensible.

#### Decision: Structured metadata, not transcripts

- **Context:** Monitoring must not become source-code or prompt surveillance (SPEC §3.2, §8).
- **Choice:** Persist lifecycle, duration, model, token, cost, tool-name, and safe error metadata. Drop prompt text, completion text, command output, environment variables, and file contents at ingestion.
- **Consequences:** Diagnostics cannot reconstruct conversations; users must use each provider's own history for that purpose.

#### Decision: SSE for client updates

- **Context:** Extension clients need one-way live state updates from the elected host.
- **Options:** polling; WebSocket; Server-Sent Events.
- **Choice:** SSE plus ordinary HTTP commands.
- **Rationale:** The protocol is simple, reconnectable, one-directional, and needs no additional package.
- **Consequences:** Commands remain request/response endpoints and every client maintains a reconnect loop.

### 1.3 Direct Dependency Inventory

| Package | Scope | License | Purpose |
|---|---|---|---|
| `zod` | production | MIT | Validate untrusted hook, callback, adapter, and stored payloads. |
| `typescript` | development | Apache-2.0 | Strict compilation. |
| `esbuild` | development | MIT | Bundling and source maps. |
| `vitest` | development | MIT | Unit/integration tests. |
| `fast-check` | development | MIT | State-machine property tests. |
| `@vscode/test-electron` | development | MIT | VS Code-hosted tests. |
| `eslint` and TypeScript ESLint packages | development | MIT | Static analysis. |
| `@vscode/vsce` | development | MIT | Release package generation. |

## 2. Design Patterns

### 2.1 Hexagonal Architecture

The domain and application services cannot depend on VS Code, SQLite, HTTP, or provider formats. These are ports implemented by adapters.

```ts
export interface EventStore {
  append(events: readonly AgentEvent[]): Promise<AppendResult>;
  querySessions(filter: SessionFilter): Promise<readonly AgentSession[]>;
}

export class IngestEvents {
  constructor(private readonly store: EventStore, private readonly bus: EventBus) {}
  async execute(input: unknown): Promise<void> { /* validate, reduce, persist, publish */ }
}
```

### 2.2 Adapter and Strategy

Every provider maps its own observations into the core contract and advertises its fidelity.

```ts
export interface AgentAdapter {
  readonly descriptor: AdapterDescriptor;
  start(context: AdapterContext): Promise<Disposable>;
  diagnose(): Promise<AdapterDiagnostic>;
}

export type AdapterFactory = (services: AdapterServices) => AgentAdapter;
```

### 2.3 Explicit Session State Machine

Only valid transitions are reduced; late events can update metrics without reviving a terminal session.

```ts
const transitions: Record<SessionStatus, ReadonlySet<SessionStatus>> = {
  starting: new Set(['running', 'failed', 'stopped', 'unknown']),
  running: new Set(['waiting', 'completed', 'failed', 'stopped', 'unknown']),
  waiting: new Set(['running', 'completed', 'failed', 'stopped', 'unknown']),
  completed: new Set(), failed: new Set(), stopped: new Set(),
  unknown: new Set(['running', 'waiting', 'completed', 'failed', 'stopped'])
};
```

### 2.4 Event Journal with CQRS-lite Projection

Writes append immutable sanitized events; reads use a `sessions` projection updated in the same transaction. This supplies history and fast tree reads without full event-sourcing complexity.

```ts
await store.transaction(async tx => {
  const inserted = await tx.insertEvent(event);
  if (!inserted) return;
  const next = reduceSession(await tx.getSession(event.sessionId), event);
  await tx.upsertSession(next);
});
```

### 2.5 Observer/Event Bus

The ingest use case emits changes; projection refresh, notifications, SSE broadcasting, and status bar updates subscribe independently.

```ts
eventBus.on('session.changed', session => broadcaster.publish(session));
eventBus.on('session.changed', session => notifications.evaluate(session));
eventBus.on('adapter.health', health => diagnostics.record(health));
```

### 2.6 Validation Pipeline

External data passes through size limit, authentication, JSON parse, envelope schema, adapter payload schema, sanitization, deduplication, and persistence. A failed stage returns a safe typed error and never reaches later stages.

## 3. Project Structure

```text
agent-panorama/
├── .github/
│   ├── ISSUE_TEMPLATE/{bug_report.yml,feature_request.yml}
│   └── workflows/{ci.yml,release.yml}
├── assets/{icon.png,logo.svg,screenshot-dashboard.png}
├── docs/
│   ├── SPECIFICATION.md
│   ├── IMPLEMENTATION.md
│   ├── TASKS.md
│   ├── BRANDING.md
│   ├── PRIVACY.md
│   ├── ADAPTERS.md
│   ├── LITELLM.md
│   ├── CLAUDE_CODE.md
│   └── TROUBLESHOOTING.md
├── examples/
│   ├── curl-event.sh
│   └── litellm/agent_panorama_callback.py
├── src/
│   ├── extension.ts
│   ├── compositionRoot.ts
│   ├── domain/
│   │   ├── events.ts
│   │   ├── sessions.ts
│   │   ├── adapters.ts
│   │   ├── errors.ts
│   │   └── reducer.ts
│   ├── application/
│   │   ├── ingestEvents.ts
│   │   ├── querySessions.ts
│   │   ├── manageHistory.ts
│   │   ├── attentionRules.ts
│   │   └── diagnostics.ts
│   ├── adapters/
│   │   ├── registry.ts
│   │   ├── litellm/{adapter.ts,schemas.ts}
│   │   ├── claude/{adapter.ts,hooks.ts,schemas.ts}
│   │   ├── codex/{adapter.ts,discovery.ts,schemas.ts}
│   │   ├── copilot/{adapter.ts,capabilities.ts}
│   │   └── process/{adapter.ts,scanner.ts}
│   ├── infrastructure/
│   │   ├── database/{sqliteStore.ts,migrations.ts,schema.ts}
│   │   ├── server/{monitorServer.ts,auth.ts,sseHub.ts,routes.ts}
│   │   ├── leadership/{lease.ts,coordinator.ts}
│   │   ├── security/{sanitize.ts,secrets.ts,redact.ts}
│   │   └── logging/outputLogger.ts
│   ├── vscode/
│   │   ├── commands.ts
│   │   ├── tree/{provider.ts,items.ts}
│   │   ├── detail/{panel.ts,html.ts}
│   │   ├── onboarding.ts
│   │   ├── notifications.ts
│   │   ├── statusBar.ts
│   │   └── settings.ts
│   └── webview/{main.ts,styles.css}
├── test/
│   ├── unit/{reducer.test.ts,sanitize.test.ts,attentionRules.test.ts}
│   ├── contract/adapters.contract.test.ts
│   ├── integration/{sqliteStore.test.ts,monitorServer.test.ts,leadership.test.ts}
│   ├── extension/{suite/index.ts,suite/extension.test.ts,runTest.ts}
│   └── fixtures/{claude,codex,litellm}
├── CHANGELOG.md
├── LICENSE
├── README.md
├── SECURITY.md
├── CONTRIBUTING.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
└── esbuild.mjs
```

### 3.1 Module Dependency Graph

```text
VS Code UI ───────┐
Provider adapters ├──> application use cases ──> domain
HTTP/SSE server ──┘             │
                                └──> infrastructure ports
                                         ├── SQLite
                                         ├── SecretStorage
                                         └── Output channel
```

Dependencies point inward. Provider adapters may import domain contracts and shared validation helpers, never UI or persistence implementations.

## 4. Domain Contracts

```ts
export type SessionStatus =
  | 'starting' | 'running' | 'waiting' | 'completed'
  | 'failed' | 'stopped' | 'unknown';

export interface AgentEvent {
  schemaVersion: 1;
  id: string;
  sessionId: string;
  provider: string;
  type: 'lifecycle' | 'tool' | 'usage' | 'message' | 'error' | 'heartbeat';
  occurredAt: string;
  confidence: 'exact' | 'inferred' | 'unknown';
  workspace?: { id?: string; label?: string };
  payload: Record<string, unknown>;
}
```

Event IDs use provider IDs when available. Otherwise the adapter derives a SHA-256 key from provider, session, type, timestamp, and safe stable fields. Session IDs are namespaced by provider.

## 5. Persistence

### 5.1 Schema

```sql
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  type TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  confidence TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_id TEXT,
  workspace_id TEXT,
  workspace_label TEXT,
  status TEXT NOT NULL,
  confidence TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ended_at INTEGER,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK(input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK(output_tokens >= 0),
  cost_usd_micros INTEGER NOT NULL DEFAULT 0 CHECK(cost_usd_micros >= 0),
  last_event_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS adapter_health (
  adapter_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  status TEXT NOT NULL,
  capabilities_json TEXT NOT NULL CHECK(json_valid(capabilities_json)),
  last_success_at INTEGER,
  last_failure_at INTEGER,
  message TEXT
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_session_time ON events(session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_received ON events(received_at);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace_status ON sessions(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
```

Migrations are monotonic TypeScript modules executed transactionally. No automatic destructive down migration occurs. Before an incompatible future migration, the store makes a bounded backup.

### 5.2 Write and Retention Policy

- Events are queued for at most 100 ms or 100 records, then committed as a transaction.
- Queue capacity is 10,000. Overflow drops oldest heartbeats first, records a diagnostic, and preserves terminal/error events.
- A daily job deletes expired events, removes orphaned terminal projections, checkpoints WAL, and vacuums only when free pages exceed 25%.

## 6. Local Protocol

The leader writes a discovery record into extension global storage containing a random port, instance ID, protocol version, process ID, lease expiry, and a secret reference—not the secret itself. File creation uses exclusive semantics; stale leaders are verified by expired lease plus failed health probe before takeover.

### 6.1 Routes

| Method | Route | Authentication | Handler |
|---|---|---|---|
| GET | `/health` | none | Safe protocol/version and leader health only. |
| POST | `/v1/events` | bearer | Validate and ingest one event. |
| POST | `/v1/events/batch` | bearer | Validate and ingest 1–100 events atomically per accepted item. |
| GET | `/v1/sessions` | bearer | Return filtered session projection. |
| GET | `/v1/sessions/:id/events` | bearer | Return cursor-paginated timeline. |
| GET | `/v1/stream` | bearer | SSE projection and adapter-health updates. |

The server binds only to `127.0.0.1` on an ephemeral port, disables CORS, uses constant-time bearer comparison, limits headers/body/time, and never logs authorization values.

## 7. Provider Implementations

### 7.1 LiteLLM

A bundled example custom callback posts lifecycle and usage envelopes. Configuration instructions generate the endpoint and place the bearer secret in an environment variable chosen by the user. Correlation priority: explicit `agent_panorama_session_id`, standard trace metadata, then an unassigned request session.

### 7.2 Claude Code

The extension manages only an AgentPanorama-owned hook entry and merges it into supported user settings after showing a diff. The hook executes a small Node entry point from the installed extension and posts sanitized stdin payloads. Installation and removal preserve unrelated settings byte-for-byte where possible and create a timestamped backup before mutation.

### 7.3 Codex CLI

The adapter watches documented/local Codex session outputs using `FileSystemWatcher` where possible and a throttled filesystem watcher otherwise. Parsers are versioned, fixture-tested, size-limited, and tolerate partial JSONL writes. Files are opened read-only. Process scanning is optional fallback and uses platform-specific commands behind one interface.

### 7.4 Copilot

The adapter checks for the official extension IDs and public exports. Capabilities are discovered at runtime. It reports availability and supported activity only; absence of a public session API is a valid healthy state and is clearly represented in onboarding.

## 8. UI Implementation

The tree uses native `TreeDataProvider` APIs for accessibility and performance. It receives projection deltas, coalesces refreshes over 100 ms, and refreshes the smallest affected node. Filters persist in workspace/global state.

The detail webview receives immutable view models through `postMessage`. HTML escapes all dynamic text, CSP denies network access, scripts are local and nonce-bound, and timeline rows are windowed to avoid rendering thousands of nodes.

## 9. Configuration

| Setting | Type | Default | Purpose |
|---|---|---:|---|
| `agentPanorama.enabled` | boolean | true | Master enable switch. |
| `agentPanorama.history.retentionDays` | integer | 14 | 1–90 day retention. |
| `agentPanorama.history.showCompletedHours` | integer | 24 | Recent completed visibility. |
| `agentPanorama.notifications.waiting` | boolean | true | Waiting-for-input notifications. |
| `agentPanorama.notifications.completed` | boolean | false | Completion notifications. |
| `agentPanorama.notifications.failed` | boolean | true | Failure notifications. |
| `agentPanorama.notifications.longRunningMinutes` | integer | 30 | Zero disables threshold. |
| `agentPanorama.quietHours` | string | empty | Optional `HH:mm-HH:mm` local interval. |
| `agentPanorama.adapters.litellm.enabled` | boolean | true | Enable ingestion support. |
| `agentPanorama.adapters.claude.enabled` | boolean | true | Enable Claude discovery/hooks. |
| `agentPanorama.adapters.codex.enabled` | boolean | true | Enable Codex discovery. |
| `agentPanorama.adapters.copilot.enabled` | boolean | true | Enable Copilot capability detection. |
| `agentPanorama.adapters.process.enabled` | boolean | false | Opt-in process inference. |
| `agentPanorama.logLevel` | enum | `info` | `error`, `warn`, `info`, or `debug`. |

The ingestion secret is never a setting. It is generated with 32 cryptographically random bytes and stored through `SecretStorage`.

## 10. Error Handling

| Category | Behavior | User surface |
|---|---|---|
| Validation | Reject event, count failure, debug log safe path | Diagnostics aggregate |
| Authentication | 401, no payload processing | Warning after repeated local failures |
| Unsupported format | Disable affected parser only | Adapter degraded badge and action |
| Database busy | Bounded retry with jitter | Silent unless threshold exceeded |
| Database corrupt | Stop writes, preserve file, offer recovery export | High-priority error |
| Leader conflict | Close newer server, reconnect to valid leader | Debug unless recovery fails |
| Adapter exception | Catch at adapter boundary, mark degraded | Diagnostic item; other adapters continue |

Domain errors use stable codes. User messages never contain tokens, secrets, raw provider payloads, or full filesystem paths by default.

## 11. Testing and Quality Gates

| Level | Tool | Required coverage |
|---|---|---|
| Unit | Vitest | Domain/application lines 90%, branches 85% |
| Property | fast-check | State transitions, deduplication, ordering invariants |
| Contract | Vitest fixtures | Every adapter capability and malformed-input family |
| Integration | Vitest + real temp SQLite/HTTP | Store, auth, SSE reconnect, leadership takeover |
| Extension | VS Code test-electron | Activation, tree, commands, settings, secret storage |
| Package smoke | `vsce package` + clean profile install | Linux CI plus documented local checks |

CI matrix runs Node 22 on Ubuntu, macOS, and Windows for lint, typecheck, unit, contract, and integration tests. Ubuntu runs VS Code extension tests under Xvfb. Packaging runs after all checks; releases are created only from signed `v*` tags with matching `package.json` and CHANGELOG versions.

## 12. Security and Release Engineering

- Dependabot tracks npm and GitHub Actions dependencies.
- CI uses pinned major actions with least-privilege permissions.
- Release workflow creates a VSIX and SHA-256 checksum but does not publish to Marketplace without a repository secret and an explicit workflow dispatch.
- `npm audit --omit=dev` and license checks block high/critical production issues or incompatible licenses.
- `SECURITY.md` defines private vulnerability reporting.
- The Marketplace package excludes fixtures, source maps, internal docs, and development scripts through `.vscodeignore`.

## 13. Development and Release Commands

```bash
npm ci
npm run check
npm run test
npm run test:extension
npm run package
code --install-extension dist/agent-panorama-1.0.0.vsix
```

GitHub uses short feature branches, Conventional Commit subjects, required CI before merge, and squash merging. Marketplace publication remains a manual owner action; the repository release provides the exact tested VSIX.
