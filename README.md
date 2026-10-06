# AgentPanorama

> See every coding agent at a glance.

AgentPanorama is a local-first VS Code monitor for AI coding sessions. It accepts a small provider-neutral event format, groups sessions by workspace and provider, and shows live state, usage, history, and attention notifications without uploading your code or conversations.

## Features

- One Activity Bar view for LiteLLM, Claude Code, Codex CLI, and available GitHub Copilot capabilities.
- Automatic discovery of `claude-saka`, `claude-codex`, `claude`, and `codex` processes running inside VS Code integrated terminals.
- Running, waiting, completed, failed, stopped, and unknown states with explicit confidence.
- Authenticated loopback ingestion endpoint and SSE updates.
- Local, bounded history with atomic writes.
- Session timeline, token/cost totals, status bar counts, diagnostics, and notifications.
- No account, hosted service, prompt collection, source-code collection, or terminal scraping.

## Quick start

1. Install the VSIX or Marketplace extension.
2. Run **AgentPanorama: Copy Ingestion Endpoint** from the Command Palette.
3. Run **AgentPanorama: Copy Ingestion Token** and keep the token private.
4. Configure your agent or LiteLLM callback to send normalized events.

```bash
curl -X POST "$AGENT_PANORAMA_ENDPOINT" \
  -H "Authorization: Bearer $AGENT_PANORAMA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schemaVersion": 1,
    "id": "event-001",
    "sessionId": "claude:my-api:001",
    "provider": "claude",
    "type": "lifecycle",
    "occurredAt": "2026-10-06T12:00:00.000Z",
    "confidence": "exact",
    "workspace": { "label": "my-api" },
    "payload": { "status": "running", "model": "claude" }
  }'
```

Use `/v1/events/batch` for an array of up to 100 events. See [LiteLLM setup](docs/LITELLM.md), [Claude Code setup](docs/CLAUDE_CODE.md), and the [privacy policy](docs/PRIVACY.md).

## What provider support means

| Provider | v1 capability |
|---|---|
| LiteLLM | Exact lifecycle/usage events through authenticated callbacks |
| Claude Code | CLI detection plus generic hook ingestion contract |
| Codex CLI | CLI detection plus generic event ingestion contract |
| GitHub Copilot | Official extension detection; session data only if a public API exposes it |
| Any agent | The normalized HTTP event API |

AgentPanorama does not claim access that providers do not expose. A detected tool can appear in diagnostics even when precise session events require a hook or wrapper.

## Development

```bash
npm ci
npm run check
npm run package
```

Press `F5` in VS Code to launch an Extension Development Host. Run **AgentPanorama: Add Demo Session** to verify the dashboard.

## Privacy and security

The server listens only on `127.0.0.1`. Every data route requires a randomly generated bearer token shared atomically between local VS Code windows, stored with user-only file permissions, and mirrored into VS Code SecretStorage. AgentPanorama rejects payloads over 1 MiB and does not store prompt bodies, completion bodies, source code, environment variables, command output, or terminal transcripts by design.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) first.

MIT © Mesut Piskin
