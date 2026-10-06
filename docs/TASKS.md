# AgentPanorama — Tasks

> Ordered release plan. The checked state is maintained during implementation.

## Summary

| Metric | Value |
|---|---:|
| Tasks | 16 |
| Phases | 5 |
| Release target | VS Code Marketplace-ready v1.0.0 |

## Phase 1 — Foundation

### Task 1: Extension scaffolding
- Create package metadata, strict TypeScript configuration, build/lint/test tooling, ignore rules, license, and extension entry point.
- Verify typecheck, lint, tests, and production bundle.

### Task 2: Domain contracts and schemas
- Implement event/session/adapter contracts, Zod schemas, typed errors, and the session reducer.
- Test every valid transition, invalid transition, ordering, and usage aggregation.

### Task 3: Durable event store
- Implement SQLite migrations, deduplicated append, transactional session projection, pagination, retention, and clear operations.
- Test restart persistence, duplicate IDs, filtering, and expiry.

## Phase 2 — Local Monitor

### Task 4: Authenticated ingestion server
- Implement loopback health, single/batch ingestion, session query, timeline, payload limits, and stable errors.
- Test missing/invalid secrets, malformed data, limits, and valid ingestion.

### Task 5: Cross-window leadership and updates
- Implement lease discovery, stale takeover, leader/client modes, SSE broadcasts, and reconnect backoff.
- Test one-leader invariant and takeover.

### Task 6: Attention and diagnostics services
- Implement notification deduplication, quiet hours, long-running rules, adapter health, and sanitized diagnostic export.

## Phase 3 — Provider Adapters

### Task 7: Adapter registry and contract kit
- Implement lifecycle isolation, capability declarations, health reporting, and reusable contract tests.

### Task 8: LiteLLM adapter
- Add callback ingestion mapping, correlation rules, example Python callback, and setup guide.

### Task 9: Claude Code adapter
- Add capability detection, safe hook installer/remover, lifecycle mapper, backups, fixtures, and setup guide.

### Task 10: Codex adapter
- Add read-only session discovery, versioned JSONL parser, partial-write handling, fixtures, and process fallback.

### Task 11: Copilot adapter
- Add official extension detection and truthful runtime capability reporting using public APIs only.

## Phase 4 — VS Code Experience

### Task 12: Dashboard tree and status bar
- Add workspace/provider/session tree, filters, icons, context menus, status counts, and focused refreshes.

### Task 13: Session detail panel
- Add CSP-protected, theme-aware timeline, metrics, adapter fidelity, pagination, and diagnostic copy.

### Task 14: Onboarding, settings, and commands
- Add first-run provider scan, hook setup actions, notification settings, history management, and troubleshooting commands.

## Phase 5 — Release

### Task 15: Quality and security gates
- Complete unit, property, contract, integration, extension-host, accessibility, and package smoke tests.
- Add cross-platform CI, Dependabot, security policy, issue templates, and least-privilege workflow permissions.

### Task 16: Marketplace package and GitHub release
- Complete branding assets, README, privacy policy, changelog, VSIX packaging, checksum, repository metadata, tag, and GitHub release.
- Marketplace publishing remains a manual owner action.

## Dependency Graph

```text
1 → 2 → 3 → 4 → 5 → 6
        └────→ 7 → 8 → 9 → 10 → 11
                         6 + 7 ──→ 12 → 13 → 14 → 15 → 16
```

## Release Acceptance

- `npm run check`, `npm test`, and `npm run package` pass.
- A clean VS Code profile installs the VSIX and shows AgentPanorama in the Activity Bar.
- A sample LiteLLM-compatible event appears within two seconds.
- Claude, Codex, and Copilot detection never requires private APIs or transcript capture.
- GitHub release contains the tested VSIX and SHA-256 checksum.

