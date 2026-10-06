# AgentPanorama — Implementation Prompt

Build a production-ready VS Code desktop extension named **AgentPanorama — AI Agent Monitor**. It provides a local-first unified dashboard for LiteLLM, Claude Code, Codex CLI, and publicly exposed GitHub Copilot activity. It must never scrape private extension state or store prompts, completions, source code, environment variables, terminal output, or command output by default.

## Required stack

- TypeScript 5.9.3 in strict mode
- VS Code API `^1.139.0`
- esbuild 0.28.2
- Zod 4.6.5
- Vitest 5.0.3 and fast-check 4.10.2
- ESLint 10.12.0
- `@vscode/test-electron` 3.1.0 and `@vscode/vsce` 4.0.0

## Architectural invariants

1. Domain and application modules import no VS Code, SQLite, HTTP, or provider-specific APIs.
2. Every provider implements one versioned adapter contract and declares capability confidence.
3. Events are runtime-validated, sanitized, deduplicated, persisted by atomic file replacement, reduced into session projections, and only then broadcast.
4. The local server binds to `127.0.0.1`, uses an ephemeral port, requires a 32-byte bearer secret, rejects bodies over 1 MiB, and never logs secrets.
5. Exactly one VS Code extension host is the leader; clients discover it through a leased record and reconnect with bounded exponential backoff.
6. Copilot integration uses documented public APIs only. Missing telemetry is represented honestly.
7. Webviews deny remote resources and use nonce-bound scripts with a strict CSP.

## Core event contract

```ts
type SessionStatus = 'starting' | 'running' | 'waiting' | 'completed' | 'failed' | 'stopped' | 'unknown';
interface AgentEvent {
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

Implement in this order: package scaffolding; domain schemas and reducer; local event/session store; ingestion HTTP and SSE; leadership; adapter registry; LiteLLM mapper/example callback; Claude hook mapper and safe setup; Codex read-only discovery/parser; Copilot public capability detection; Activity Bar tree; status bar; CSP detail panel; onboarding/settings/diagnostics; unit/integration/extension tests; CI and Marketplace documentation; VSIX packaging.

The normalized state machine permits `starting → running|failed|stopped|unknown`, `running → waiting|completed|failed|stopped|unknown`, `waiting → running|completed|failed|stopped|unknown`, and `unknown → any non-starting state`. Terminal states never revive. Late usage events may update metrics without changing terminal status.

Persist immutable events and a session projection through permission-restricted temporary-file writes followed by atomic replacement. Retain 14 days by default with a configurable 1–90 day range.

Expose `GET /health`, `POST /v1/events`, `POST /v1/events/batch`, `GET /v1/sessions`, `GET /v1/sessions/:id/events`, and `GET /v1/stream`. Use stable JSON error codes. Batch size is 100 events. Queue capacity is 10,000 and sheds heartbeats before terminal/error events.

The Activity Bar groups sessions by workspace then provider. Each session shows status, confidence, duration, and last activity. Commands cover refresh, reveal details, copy sanitized diagnostics, provider setup, clear history, and open settings. The status bar shows active/waiting/failed counts. Notifications are configurable and deduplicated.

Create comprehensive README, CHANGELOG, LICENSE, SECURITY, CONTRIBUTING, privacy policy, provider setup guides, icon/banner assets, issue templates, CI/release workflows, `.vscodeignore`, and a reproducible `dist/agent-panorama-1.0.0.vsix` plus SHA-256 checksum. Use MIT licensing and author metadata supplied by the repository owner.

Before completion run lint, typecheck, unit/integration tests, production build, `vsce ls`, VSIX packaging, and a clean-profile installation smoke test where possible. Fix every failure. Do not publish to the Marketplace; provide the tested VSIX and GitHub release for the owner.
