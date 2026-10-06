import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EventStore } from '../src/application/store.js';
import type { AgentEvent } from '../src/domain/model.js';

const sample: AgentEvent = { schemaVersion: 1, id: 'e1', sessionId: 's1', provider: 'test', type: 'lifecycle', occurredAt: '2026-10-06T10:00:00.000Z', confidence: 'exact', payload: { status: 'running' } };

describe('EventStore', () => {
  it('persists sessions atomically and deduplicates events', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'agent-panorama-')); const store = new EventStore(dir); await store.initialize();
    await store.append([sample, sample]); expect(store.sessions()).toHaveLength(1); expect(store.events('s1')).toHaveLength(1);
    const disk = JSON.parse(await readFile(path.join(dir, 'events.json'), 'utf8')) as { events: unknown[] }; expect(disk.events).toHaveLength(1);
  });
});
