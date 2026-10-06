import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export async function loadSharedToken(directory: string): Promise<string> {
  await fs.mkdir(directory, { recursive: true });
  const tokenFile = path.join(directory, 'monitor-token');
  const candidate = randomBytes(32).toString('base64url');
  try {
    const handle = await fs.open(tokenFile, 'wx', 0o600);
    try { await handle.writeFile(candidate, 'utf8'); } finally { await handle.close(); }
    return candidate;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const existing = (await fs.readFile(tokenFile, 'utf8')).trim();
    if (TOKEN_PATTERN.test(existing)) return existing;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('The shared monitor token file is invalid.');
}
