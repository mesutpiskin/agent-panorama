# LiteLLM setup

AgentPanorama accepts normalized callback events at the endpoint shown by **AgentPanorama: Copy Ingestion Endpoint**. Copy the bearer token separately and expose both only to your local callback process.

For a LiteLLM custom callback, map request start/success/failure to `lifecycle` or `usage` events. Put a stable agent invocation ID in `sessionId`; use LiteLLM's request/call ID only when no higher-level agent session ID exists. Send model, token, latency, and reported cost as numeric payload fields. Never forward prompt or response bodies.

Required headers:

```text
Authorization: Bearer <local token>
Content-Type: application/json
```

The endpoint changes after the extension host restarts. A production callback wrapper should obtain the current endpoint from the extension command or a user-controlled environment injection step rather than hard-coding the port.

