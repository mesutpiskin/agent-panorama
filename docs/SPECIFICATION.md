# AgentPanorama — Specification

> Monitor every AI coding agent from one local-first VS Code dashboard.

## 1. Overview

### 1.1 What Is AgentPanorama?

AgentPanorama is an open-source VS Code extension that gives developers a unified, real-time view of AI coding agents running across terminals, workspaces, and VS Code windows. It normalizes activity from LiteLLM, Claude Code, Codex CLI, and GitHub Copilot into a common session model without requiring any one provider.

The product is local-first. Session metadata remains on the developer's machine unless the developer explicitly configures an external telemetry endpoint. Provider adapters report precise lifecycle events when supported and fall back to conservative process or terminal activity signals when an integration cannot expose richer events.

### 1.2 Target Audience

- Developers who run several AI coding agents concurrently across multiple VS Code windows.
- Teams using LiteLLM as a shared model gateway and wanting local per-session visibility.
- Claude Code, Codex CLI, or GitHub Copilot users who want one provider-neutral monitoring surface.
- Extension contributors who want to add support for another coding agent through a stable adapter API.

### 1.3 Key Differentiators

- One normalized session model across multiple coding-agent vendors.
- Local-only operation by default, with no mandatory account, cloud service, or telemetry upload.
- Cross-window visibility through a single elected local monitor host.
- Exact status signals where provider APIs or hooks permit them, with confidence clearly identified for inferred states.
- Extensible adapter contract that keeps provider-specific parsing outside the dashboard.

### 1.4 Competitive Position

AgentPanorama is not an agent runner or orchestration framework. It is a monitoring surface for tools the developer already uses. Unlike provider-specific status extensions, it presents mixed agent sessions together and distinguishes observed facts from inferred activity.

## 2. Core Concepts

| Concept | Definition |
|---|---|
| Agent | A supported AI coding tool, such as Claude Code, Codex CLI, Copilot, or a LiteLLM-backed custom tool. |
| Provider adapter | A module that discovers sessions and translates provider events into the normalized event contract. |
| Session | One continuous agent invocation associated with a workspace, process, or provider session identifier. |
| Event | An immutable lifecycle, message, tool, usage, error, or heartbeat observation. |
| Status | The current normalized state: starting, running, waiting, completed, failed, stopped, or unknown. |
| Confidence | Whether a status is exact, inferred, or unknown. |
| Monitor host | The VS Code extension host instance responsible for the shared local event service. |
| Workspace identity | A privacy-preserving identifier plus display label for the workspace owning a session. |

## 3. Functional Requirements

### 3.1 Unified Session Monitoring

**User Story:** As a developer running several agents, I want to see all active sessions in one view so that I immediately know what is running and what needs attention.

**Acceptance Criteria:**

- [ ] The Activity Bar contains an AgentPanorama view grouping sessions by workspace and provider.
- [ ] Each session shows agent name, normalized status, elapsed time, last activity, and confidence.
- [ ] Active, waiting, failed, and recently completed sessions are visually distinguishable without relying only on color.
- [ ] The view updates within two seconds of receiving an event.
- [ ] Sessions from other VS Code windows appear when those windows use the same local profile and user account.
- [ ] Commands allow refresh, filtering, opening the owning workspace, and revealing session details.

**Edge Cases:** Duplicate provider events are ignored; a crashed provider becomes `unknown` after its heartbeat expires; closed workspaces retain recent history but are marked inactive.

### 3.2 Session Detail and History

**User Story:** As a developer, I want to inspect a session timeline so that I can understand what the agent did and why it stopped.

**Acceptance Criteria:**

- [ ] A detail panel shows ordered lifecycle, tool, usage, and error events.
- [ ] Sensitive message bodies and command output are excluded by default.
- [ ] Token usage, cost, model, and latency appear only when supplied by an adapter.
- [ ] Users can copy a sanitized diagnostic summary.
- [ ] Users can clear one session or all local history after confirmation.
- [ ] Retention is configurable from 1 to 90 days, defaulting to 14 days.

### 3.3 LiteLLM Integration

**User Story:** As a LiteLLM user, I want model requests correlated with agent sessions so that I can see tokens, cost, latency, and failures.

**Acceptance Criteria:**

- [ ] AgentPanorama exposes a loopback-only HTTP ingestion endpoint with a generated secret.
- [ ] A documented LiteLLM callback configuration can submit start, success, and failure events.
- [ ] Requests can be correlated by explicit session headers or adapter metadata.
- [ ] Uncorrelated LiteLLM events appear in an `Unassigned` group rather than being dropped.
- [ ] Authorization failures do not reveal the ingestion secret in logs.
- [ ] No LiteLLM dependency is required for other adapters.

### 3.4 Claude Code Integration

**User Story:** As a Claude Code user, I want hook-based session status without routing requests through LiteLLM.

**Acceptance Criteria:**

- [ ] The extension can install, validate, and remove an opt-in AgentPanorama hook configuration.
- [ ] Supported Claude Code lifecycle and tool events map to normalized events.
- [ ] Existing user hooks are preserved and never overwritten destructively.
- [ ] Hook payloads are validated and sanitized before persistence.
- [ ] Unsupported Claude versions degrade to process-level monitoring with an explanatory status.

### 3.5 Codex CLI Integration

**User Story:** As a Codex CLI user, I want locally running Codex sessions represented in the same dashboard.

**Acceptance Criteria:**

- [ ] The adapter discovers supported Codex session metadata and lifecycle signals without modifying Codex files.
- [ ] Sessions are associated with their workspace when the source supplies a working directory.
- [ ] Unsupported or changed formats fail closed and show a diagnostic warning instead of fabricating events.
- [ ] Process fallback can report starting, active, stopped, and unknown states.

### 3.6 GitHub Copilot Integration

**User Story:** As a Copilot user, I want available Copilot activity shown while respecting VS Code extension isolation and privacy boundaries.

**Acceptance Criteria:**

- [ ] AgentPanorama uses only documented VS Code and Copilot extension surfaces.
- [ ] Copilot Chat or coding-agent activity is shown only when exposed through supported APIs, commands, logs, or user-enabled instrumentation.
- [ ] The UI states when precise Copilot session telemetry is unavailable.
- [ ] AgentPanorama never reads editor content or chat transcripts merely to infer activity.

### 3.7 Generic Adapter API

**User Story:** As a contributor, I want to add a provider without changing dashboard code.

**Acceptance Criteria:**

- [ ] Adapters implement a versioned TypeScript interface.
- [ ] Adapter capabilities declare discovery, lifecycle, usage, tool, and message support.
- [ ] Malformed adapter events are rejected with actionable diagnostics.
- [ ] A fixture-based adapter test kit validates common lifecycle behavior.
- [ ] An example adapter is included in contributor documentation.

### 3.8 Notifications and Attention

**User Story:** As a developer, I want notifications only when action is useful.

**Acceptance Criteria:**

- [ ] Notifications support waiting-for-input, completion, failure, and long-running thresholds.
- [ ] Each notification category can be disabled globally or per provider.
- [ ] Duplicate events cannot generate duplicate notifications.
- [ ] Notification actions reveal the associated session.
- [ ] Quiet hours and a global do-not-disturb setting are supported.

### 3.9 Diagnostics and Onboarding

**Acceptance Criteria:**

- [ ] First run presents a short setup checklist with provider detection results.
- [ ] A diagnostics command reports extension, runtime, adapter, endpoint, and database health without secrets.
- [ ] The extension continues operating when any individual adapter fails.
- [ ] Logs use VS Code's Output channel and support info, warning, and debug levels.

## 4. Architecture Overview

### 4.1 System Components

- **VS Code extension UI:** Activity Bar tree, status bar summary, commands, settings, notifications, and session detail webview.
- **Monitor service:** Local lifecycle coordinator, event validator, state reducer, persistence gateway, and cross-window broadcaster.
- **Adapter runtime:** Isolated provider adapters for LiteLLM, Claude Code, Codex, Copilot, and generic processes.
- **Local event store:** Durable session/event history with bounded retention.
- **Ingestion endpoint:** Authenticated loopback API for LiteLLM callbacks and provider hooks.

### 4.2 Component Interactions

Adapters emit normalized events to the monitor service. The service validates and deduplicates events, persists them, reduces them into session state, broadcasts updates to all connected extension windows, and triggers attention rules. UI components consume read models and do not parse provider data.

Exactly one extension host owns the ingestion endpoint at a time. Other windows connect as clients. Host loss triggers bounded leader re-election without requiring user action.

### 4.3 External Integrations

| Integration | Purpose | Failure behavior |
|---|---|---|
| VS Code Extension API | UI, workspace identity, notifications, secret storage | Extension activation fails with a visible diagnostic. |
| LiteLLM callbacks | Request usage and latency | Other adapters continue; endpoint health reports degraded. |
| Claude Code hooks | Precise lifecycle and tool events | Process fallback or unavailable capability notice. |
| Codex local session signals | Session lifecycle and workspace association | Adapter disables itself and reports format incompatibility. |
| GitHub Copilot extension surfaces | Available Copilot activity | Capability is marked unavailable; no private APIs are scraped. |

## 5. Data Model

### 5.1 Session

| Field | Type | Required | Description |
|---|---|---:|---|
| id | string | Yes | Stable internal session identifier. |
| provider | string | Yes | Adapter/provider identifier. |
| externalId | string | No | Provider-issued identifier. |
| workspaceId | string | No | Privacy-preserving workspace identity. |
| workspaceLabel | string | No | User-facing workspace name. |
| status | enum | Yes | Normalized status. |
| confidence | enum | Yes | exact, inferred, or unknown. |
| startedAt | timestamp | Yes | First observed activity. |
| updatedAt | timestamp | Yes | Latest event time. |
| endedAt | timestamp | No | Terminal state time. |
| model | string | No | Most recently observed model. |
| inputTokens | integer | No | Accumulated input tokens. |
| outputTokens | integer | No | Accumulated output tokens. |
| costUsd | decimal | No | Accumulated reported cost. |

### 5.2 Event

| Field | Type | Required | Description |
|---|---|---:|---|
| id | string | Yes | Unique or deterministic deduplication key. |
| sessionId | string | Yes | Owning session. |
| type | enum | Yes | lifecycle, tool, usage, message, error, or heartbeat. |
| occurredAt | timestamp | Yes | Source event time. |
| receivedAt | timestamp | Yes | Monitor receipt time. |
| source | string | Yes | Producing adapter. |
| payload | object | Yes | Validated, sanitized event-specific data. |

### 5.3 Adapter Health

Tracks adapter version, declared capabilities, last success, last failure, current status, and a sanitized diagnostic message.

### 5.4 Data Lifecycle

Events are written locally, compacted into session summaries, and purged after the configured retention interval. Clearing data deletes persisted events and summaries. Secrets are stored only in VS Code SecretStorage and never in the event database.

## 6. Local API Surface

The ingestion service binds to `127.0.0.1` only and uses JSON over HTTP. Every write requires a bearer secret from VS Code SecretStorage.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Non-sensitive service health. |
| POST | `/v1/events` | Submit one normalized event. |
| POST | `/v1/events/batch` | Submit up to 100 events. |

Requests exceeding 1 MiB, failing schema validation, or lacking authorization are rejected. Error responses contain a stable code and safe human-readable message.

## 7. User Interface

### 7.1 Activity Bar View

Workspace groups contain provider groups and sessions. Toolbar actions provide refresh, filters, history visibility, onboarding, and diagnostics. Tree items expose accessibility labels and command menus.

### 7.2 Session Detail

A VS Code-themed webview shows summary metrics, adapter capabilities, and a virtualized timeline. It renders sanitized structured data and permits no remote scripts.

### 7.3 Status Bar

An optional compact indicator shows active, waiting, and failed counts. Selecting it focuses AgentPanorama.

### 7.4 Accessibility

All operations are keyboard accessible, statuses have text labels, controls use VS Code theme tokens, and the detail view targets WCAG 2.1 AA contrast and focus behavior.

## 8. Security and Privacy

- Local-only and telemetry-free by default.
- Loopback binding, bearer authentication, payload limits, schema validation, and request timeouts for ingestion.
- No terminal transcript, source code, prompt, response, environment variable, or command output collection by default.
- Explicit settings are required before storing message previews.
- Paths shown in exported diagnostics are redacted to workspace labels unless the user opts in.
- Webview content uses a strict content security policy and nonce-based local scripts.
- Dependencies and release artifacts are checked in CI for known vulnerabilities and license compatibility.

## 9. Distribution

- Published as a VSIX and prepared for Visual Studio Marketplace publication.
- Source hosted publicly on GitHub under the MIT license.
- Marketplace package includes README, CHANGELOG, LICENSE, privacy statement, icon, screenshots, commands, settings, and verified repository links.
- Supported hosts: current stable VS Code plus the previous minor release on macOS, Linux, and Windows.
- No separate daemon installation is required; the monitor service runs inside an elected extension host.

## 10. Performance and Reliability

- Extension activation completes within 500 ms p95 when no migration is required.
- Tree updates appear within two seconds p95 after event ingestion.
- Idle memory overhead remains below 75 MiB per elected host and below 20 MiB per client window.
- The store supports 100,000 retained events without UI blocking.
- Ingestion accepts bursts of 100 events/second locally with bounded queues.
- One adapter failure cannot crash or disable other adapters.
- Database writes survive an extension-host restart without corrupting prior history.

## 11. Constraints and Non-Goals

### 11.1 Constraints

- VS Code extension isolation prevents guaranteed access to another extension's private state.
- Copilot visibility is limited to documented surfaces exposed by VS Code or GitHub.
- Provider formats and hooks may change; adapters must version-detect and fail closed.
- Status inference from processes is explicitly lower confidence than lifecycle hooks.

### 11.2 Non-Goals

- **Agent orchestration:** v1.0 does not launch, steer, approve, pause, or terminate agents.
- **Cloud dashboard:** no hosted account, synchronization service, or remote viewing is included.
- **Transcript recorder:** prompts, responses, source code, and raw terminal output are not captured by default.
- **Billing authority:** displayed cost is informational and depends on provider-supplied data.
- **Private API scraping:** undocumented Copilot or provider internals are not patched or intercepted.
- **Team analytics:** cross-user aggregation and management reporting are outside v1.0.
- **Non-VS Code IDEs:** JetBrains, Zed, Cursor-specific builds, and standalone desktop apps are not included.

### 11.3 Assumptions

- Users can opt into provider hook configuration where needed.
- A single local user profile owns collaborating VS Code windows.
- Marketplace publication credentials remain the user's responsibility.
- The GitHub repository will be owned by `mesutpiskin` and use the author's supplied public email in package metadata.

## 12. Release Acceptance

AgentPanorama v1.0 is release-ready when:

- Core, LiteLLM, Claude Code, and Codex adapter test suites pass on macOS, Linux, and Windows CI.
- Copilot capability detection is truthful and covered by tests without depending on private APIs.
- Extension integration tests pass on the minimum and latest supported VS Code releases.
- A clean profile can complete onboarding, ingest a sample event, inspect it, receive a notification, export diagnostics, and clear history.
- `npm audit` reports no known high or critical production vulnerabilities.
- A reproducible `.vsix` package installs successfully and passes `vsce ls` content review.

## 13. Future Considerations

- **v1.1:** OpenCode, Aider, Gemini CLI, Cursor, and remote SSH/dev-container adapters.
- **v1.2:** Optional OpenTelemetry export and Grafana-compatible metrics.
- **v2.0:** Encrypted peer-to-peer remote monitoring and opt-in team dashboards.
