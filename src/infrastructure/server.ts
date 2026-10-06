import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { agentEventSchema, type AgentSession } from '../domain/model.js';
import type { EventStore } from '../application/store.js';

const MAX_BODY = 1_048_576;

export interface MonitorServerInfo { port: number; endpoint: string }

export class MonitorServer {
  readonly #clients = new Set<ServerResponse>();
  #server?: ReturnType<typeof createServer>;
  constructor(private readonly store: EventStore, private readonly token: string, private readonly onSessions: (sessions: AgentSession[]) => void) {}

  async start(port = 39457): Promise<MonitorServerInfo> {
    this.#server = createServer((request, response) => { void this.route(request, response); });
    await new Promise<void>((resolve, reject) => {
      this.#server?.once('error', reject);
      this.#server?.listen(port, '127.0.0.1', () => resolve());
    });
    const address = this.#server.address();
    if (!address || typeof address === 'string') throw new Error('Unable to bind monitor server');
    return { port: address.port, endpoint: `http://127.0.0.1:${address.port}` };
  }

  async stop(): Promise<void> {
    for (const client of this.#clients) client.end();
    await new Promise<void>(resolve => this.#server?.close(() => resolve()));
  }

  private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/health') return this.json(response, 200, { ok: true, service: 'agent-panorama', protocol: 1 });
      if (!this.authorized(request)) return this.json(response, 401, { error: { code: 'UNAUTHORIZED', message: 'A valid bearer token is required.' } });
      if (request.method === 'GET' && url.pathname === '/v1/sessions') return this.json(response, 200, { data: this.store.sessions() });
      if (request.method === 'GET' && url.pathname === '/v1/stream') return this.stream(request, response);
      const match = /^\/v1\/sessions\/([^/]+)\/events$/.exec(url.pathname);
      if (request.method === 'GET' && match?.[1]) return this.json(response, 200, { data: this.store.events(decodeURIComponent(match[1])) });
      if (request.method === 'POST' && (url.pathname === '/v1/events' || url.pathname === '/v1/events/batch')) {
        const body = await this.readBody(request);
        const values: unknown[] = url.pathname.endsWith('/batch') ? this.requireBatch(body) : [body];
        const events = values.map(value => agentEventSchema.parse(value));
        const changed = await this.store.append(events);
        if (changed.length) { this.onSessions(changed); this.broadcast(changed); }
        return this.json(response, 202, { data: { accepted: events.length, changed: changed.length } });
      }
      return this.json(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found.' } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid request';
      this.json(response, message === 'PAYLOAD_TOO_LARGE' ? 413 : 400, { error: { code: message === 'PAYLOAD_TOO_LARGE' ? 'PAYLOAD_TOO_LARGE' : 'INVALID_REQUEST', message } });
    }
  }

  private authorized(request: IncomingMessage): boolean {
    const value = request.headers.authorization;
    if (!value?.startsWith('Bearer ')) return false;
    const received = Buffer.from(value.slice(7)); const expected = Buffer.from(this.token);
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  private async readBody(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      size += buffer.length; if (size > MAX_BODY) throw new Error('PAYLOAD_TOO_LARGE'); chunks.push(buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  }

  private requireBatch(value: unknown): unknown[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new Error('Batch must contain 1 to 100 events.');
    return value;
  }

  private stream(request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    response.write(`event: ready\ndata: {"protocol":1}\n\n`); this.#clients.add(response);
    request.on('close', () => this.#clients.delete(response));
  }

  private broadcast(sessions: AgentSession[]): void {
    const data = JSON.stringify({ sessions });
    for (const client of this.#clients) client.write(`event: sessions\ndata: ${data}\n\n`);
  }

  private json(response: ServerResponse, status: number, body: unknown): void {
    if (response.headersSent) return;
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(JSON.stringify(body));
  }
}
