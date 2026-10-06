# Privacy

AgentPanorama is local-first and has no product analytics or remote telemetry.

It stores normalized session metadata under VS Code's extension global-storage directory: provider, session/workspace labels, lifecycle state, timestamps, declared model, token counts, cost, tool name, and sanitized error summaries. It does not intentionally collect prompt text, model response text, source code, file contents, environment variables, command output, or terminal transcripts.

The ingestion server binds to loopback only and requires a secret stored by VS Code SecretStorage. Local software running as the same operating-system user may still access processes and files available to that user; protect your workstation accordingly.

Use **AgentPanorama: Clear History** to delete the extension's event journal. Uninstalling an extension may not automatically remove VS Code global storage; clear history before uninstalling if this matters to you.

