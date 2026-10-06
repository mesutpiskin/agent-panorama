import { describe, expect, it } from 'vitest';
import { agentEventSchema } from '../src/domain/model.js';

describe('agentEventSchema', () => {
  it('accepts a normalized event', () => {
    expect(agentEventSchema.safeParse({ schemaVersion: 1, id: '1', sessionId: 's', provider: 'claude', type: 'lifecycle', occurredAt: '2026-10-06T10:00:00.000Z', confidence: 'exact', payload: { status: 'running' } }).success).toBe(true);
  });
  it('rejects unknown top-level fields and oversized payload strings', () => {
    expect(agentEventSchema.safeParse({ schemaVersion: 1, id: '1', sessionId: 's', provider: 'x', type: 'message', occurredAt: 'bad', confidence: 'exact', payload: {}, secret: 'no' }).success).toBe(false);
  });
});
