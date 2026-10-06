# Changelog

## 1.1.0 — 2026-10-06

- Added automatic process discovery for `claude-saka`, `claude-codex`, `claude`, and `codex` running in VS Code integrated terminals.
- Associates detected processes with their VS Code terminal/workspace and reports inferred running/stopped states.
- Suppresses nested provider processes when a wrapper such as `claude-saka` owns the session.

## 1.0.2 — 2026-10-06

- Fixed client windows remaining disconnected after the leader extension host exits.
- Added automatic leader takeover after a connection failure.
- Collapsed repeated network failures into one diagnostic warning while recovery retries continue.

## 1.0.1 — 2026-10-06

- Fixed repeated cross-window HTTP 401 errors caused by per-window token races.
- Added an atomic, permission-restricted shared monitor token.
- Replaced repeated authentication log spam with one actionable reload warning.
- Reduced client polling frequency to avoid unnecessary dashboard refreshes.

## 1.0.0 — 2026-10-06

- Added unified workspace/provider/session dashboard.
- Added authenticated local event and batch ingestion APIs.
- Added live SSE updates, session detail timeline, usage totals, status bar, notifications, and diagnostics.
- Added LiteLLM-ready generic callbacks and Claude Code/Codex CLI/Copilot capability detection.
- Added bounded local history, privacy controls, automated tests, CI, and Marketplace packaging.
