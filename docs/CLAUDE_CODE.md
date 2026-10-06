# Claude Code setup

AgentPanorama detects the `claude` executable. Exact session states require a Claude Code hook or wrapper that posts normalized events to the local ingestion endpoint.

Map provider lifecycle events as follows:

| Claude event | AgentPanorama status |
|---|---|
| session/start | `running` |
| user input required | `waiting` |
| successful stop | `completed` |
| failed stop | `failed` |

Use a stable Claude session ID, include the workspace label, and mark hook-derived events as `exact`. Process-only observations must be marked `inferred`. Do not forward hook fields containing prompts, responses, file contents, commands, environment variables, or tool output.

AgentPanorama v1.0 intentionally does not modify Claude settings automatically. This avoids overwriting existing hooks; a guided, merge-safe installer is planned after hook formats are version-detected across supported Claude Code releases.

