import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AgentEvent, AgentSession, StoreData } from '../domain/model.js';
import { reduceSession } from '../domain/reducer.js';

export class EventStore {
  readonly #file: string;
  #data: StoreData = { version: 1, events: [], sessions: [] };
  #write = Promise.resolve();

  constructor(directory: string) { this.#file = path.join(directory, 'events.json'); }

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.#file), { recursive: true });
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(this.#file, 'utf8'));
      if (typeof parsed === 'object' && parsed !== null && 'version' in parsed && parsed.version === 1) this.#data = parsed as StoreData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') await this.backupCorrupt();
    }
  }

  async append(events: readonly AgentEvent[]): Promise<AgentSession[]> {
    const changed = new Map<string, AgentSession>();
    const ids = new Set(this.#data.events.map(event => event.id));
    const sessions = new Map(this.#data.sessions.map(session => [session.id, session]));
    for (const event of events) {
      if (ids.has(event.id)) continue;
      ids.add(event.id); this.#data.events.push(event);
      const next = reduceSession(sessions.get(event.sessionId), event);
      sessions.set(next.id, next); changed.set(next.id, next);
    }
    this.#data.sessions = [...sessions.values()];
    if (changed.size) await this.persist();
    return [...changed.values()];
  }

  sessions(): readonly AgentSession[] { return [...this.#data.sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  events(sessionId: string): readonly AgentEvent[] { return this.#data.events.filter(e => e.sessionId === sessionId).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)); }

  async clear(): Promise<void> { this.#data = { version: 1, events: [], sessions: [] }; await this.persist(); }

  async purge(retentionDays: number): Promise<void> {
    const cutoff = Date.now() - retentionDays * 86_400_000;
    this.#data.events = this.#data.events.filter(event => Date.parse(event.occurredAt) >= cutoff);
    const live = new Set(this.#data.events.map(event => event.sessionId));
    this.#data.sessions = this.#data.sessions.filter(session => live.has(session.id));
    await this.persist();
  }

  private async persist(): Promise<void> {
    this.#write = this.#write.then(async () => {
      const temporary = `${this.#file}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(this.#data), { encoding: 'utf8', mode: 0o600 });
      await fs.rename(temporary, this.#file);
    });
    await this.#write;
  }

  private async backupCorrupt(): Promise<void> {
    try { await fs.rename(this.#file, `${this.#file}.corrupt-${Date.now()}`); } catch { /* best effort */ }
    this.#data = { version: 1, events: [], sessions: [] };
  }
}
