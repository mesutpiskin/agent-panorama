import type { AgentEvent, AgentSession, SessionStatus } from './model.js';

const terminal = new Set<SessionStatus>(['completed', 'failed', 'stopped']);
const transitions: Record<SessionStatus, ReadonlySet<SessionStatus>> = {
  starting: new Set(['running', 'failed', 'stopped', 'unknown']),
  running: new Set(['waiting', 'completed', 'failed', 'stopped', 'unknown']),
  waiting: new Set(['running', 'completed', 'failed', 'stopped', 'unknown']),
  completed: new Set(), failed: new Set(), stopped: new Set(),
  unknown: new Set(['running', 'waiting', 'completed', 'failed', 'stopped'])
};

const number = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

export function reduceSession(current: AgentSession | undefined, event: AgentEvent): AgentSession {
  const initial: AgentSession = current ?? {
    id: event.sessionId,
    provider: event.provider,
    ...(event.workspace?.id ? { workspaceId: event.workspace.id } : {}),
    ...(event.workspace?.label ? { workspaceLabel: event.workspace.label } : {}),
    status: 'starting', confidence: event.confidence,
    startedAt: event.occurredAt, updatedAt: event.occurredAt,
    inputTokens: 0, outputTokens: 0, costUsd: 0, lastEventType: event.type
  };

  const requested = typeof event.payload.status === 'string' ? event.payload.status as SessionStatus : undefined;
  const canTransition = requested && transitions[initial.status]?.has(requested);
  const nextStatus = canTransition ? requested : initial.status;
  const endedAt = terminal.has(nextStatus) && !initial.endedAt ? event.occurredAt : initial.endedAt;
  const model = typeof event.payload.model === 'string' ? event.payload.model.slice(0, 200) : initial.model;
  return {
    ...initial,
    ...(event.workspace?.id ? { workspaceId: event.workspace.id } : {}),
    ...(event.workspace?.label ? { workspaceLabel: event.workspace.label } : {}),
    status: nextStatus,
    confidence: canTransition ? event.confidence : initial.confidence,
    updatedAt: new Date(Math.max(Date.parse(initial.updatedAt), Date.parse(event.occurredAt))).toISOString(),
    ...(endedAt ? { endedAt } : {}), ...(model ? { model } : {}),
    inputTokens: initial.inputTokens + number(event.payload.inputTokens),
    outputTokens: initial.outputTokens + number(event.payload.outputTokens),
    costUsd: initial.costUsd + number(event.payload.costUsd),
    lastEventType: event.type
  };
}
