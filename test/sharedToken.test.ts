import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSharedToken } from '../src/infrastructure/sharedToken.js';

describe('loadSharedToken', () => {
  it('returns one token when multiple extension hosts start concurrently', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'agent-panorama-token-'));
    const tokens = await Promise.all(Array.from({ length: 20 }, () => loadSharedToken(directory)));
    expect(new Set(tokens)).toHaveLength(1);
    expect(tokens[0]).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
