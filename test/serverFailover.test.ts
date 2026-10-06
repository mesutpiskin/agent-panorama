import { createServer } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EventStore } from '../src/application/store.js';
import { MonitorServer } from '../src/infrastructure/server.js';

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  await new Promise<void>(resolve => probe.close(() => resolve()));
  return address.port;
}

describe('MonitorServer leadership', () => {
  it('allows a client candidate to take over after the leader exits', async () => {
    const port = await freePort();
    const directory = await mkdtemp(path.join(tmpdir(), 'agent-panorama-failover-'));
    const store = new EventStore(directory); await store.initialize();
    const leader = new MonitorServer(store, 'token', () => undefined); await leader.start(port);
    const candidate = new MonitorServer(store, 'token', () => undefined);
    await expect(candidate.start(port)).rejects.toMatchObject({ code: 'EADDRINUSE' });
    await leader.stop();
    await expect(candidate.start(port)).resolves.toMatchObject({ port });
    await candidate.stop();
  });
});
