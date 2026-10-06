import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '../src/domain/model.js';
import { reduceSession } from '../src/domain/reducer.js';

const event = (status: string, overrides: Partial<AgentEvent> = {}): AgentEvent => ({
  schemaVersion: 1, id: `event-${status}`, sessionId: 'session-1', provider: 'test', type: 'lifecycle', occurredAt: '2026-10-06T10:00:00.000Z', confidence: 'exact', payload: { status }, ...overrides
});

describe('reduceSession', () => {
  it('moves a new session from starting to running', () => { expect(reduceSession(undefined, event('running')).status).toBe('running'); });
  it('does not revive a terminal session', () => {
    const completed = reduceSession(reduceSession(undefined, event('running')), event('completed', { id: 'done' }));
    expect(reduceSession(completed, event('running', { id: 'late' })).status).toBe('completed');
  });
  it('aggregates non-negative usage', () => {
    const first = reduceSession(undefined, event('running', { payload: { status: 'running', inputTokens: 10, outputTokens: 3, costUsd: 0.1 } }));
    const next = reduceSession(first, event('running', { id: 'usage', type: 'usage', payload: { inputTokens: 5, outputTokens: 2, costUsd: 0.2 } }));
    expect(next).toMatchObject({ inputTokens: 15, outputTokens: 5 }); expect(next.costUsd).toBeCloseTo(0.3);
  });
});
