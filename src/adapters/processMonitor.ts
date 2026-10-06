import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { AgentEvent } from '../domain/model.js';
import { findAgentProcesses, parsePosixProcesses, type ProcessEntry, type ProcessMatch } from './processDiscovery.js';

const exec = promisify(execFile);

export class TerminalProcessMonitor implements vscode.Disposable {
  readonly #known = new Map<number, ProcessMatch>();
  #timer?: NodeJS.Timeout;
  #scanning = false;

  constructor(private readonly submit: (events: readonly AgentEvent[]) => Promise<void>, private readonly log: vscode.LogOutputChannel) {}

  start(): void {
    void this.scan();
    this.#timer = setInterval(() => { void this.scan(); }, 3_000);
  }

  dispose(): void { if (this.#timer) clearInterval(this.#timer); }

  private async scan(): Promise<void> {
    if (this.#scanning) return;
    this.#scanning = true;
    try {
      const terminals = (await Promise.all(vscode.window.terminals.map(async terminal => ({ name: terminal.name, pid: await terminal.processId })))).filter((value): value is { name: string; pid: number } => typeof value.pid === 'number');
      const processes = await listProcesses();
      const matches = findAgentProcesses(processes, terminals);
      const current = new Map(matches.map(match => [match.pid, match]));
      const events: AgentEvent[] = [];
      for (const match of matches) if (!this.#known.has(match.pid)) events.push(processEvent(match, 'running'));
      for (const match of this.#known.values()) if (!current.has(match.pid)) events.push(processEvent(match, 'stopped'));
      this.#known.clear(); for (const [pid, match] of current) this.#known.set(pid, match);
      if (events.length) await this.submit(events);
    } catch (error) {
      this.log.debug(`Terminal process scan skipped: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally { this.#scanning = false; }
  }
}

async function listProcesses(): Promise<ProcessEntry[]> {
  if (process.platform === 'win32') {
    const script = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress';
    const { stdout } = await exec('powershell.exe', ['-NoProfile', '-Command', script], { timeout: 5_000, maxBuffer: 5_000_000 });
    const raw: unknown = JSON.parse(stdout); const values: unknown[] = Array.isArray(raw) ? raw as unknown[] : [raw];
    return values.flatMap(value => {
      if (typeof value !== 'object' || value === null) return [];
      const record = value as Record<string, unknown>;
      if (!('ProcessId' in record) || !('ParentProcessId' in record)) return [];
      const command = typeof record.CommandLine === 'string' ? record.CommandLine : '';
      return [{ pid: Number(record.ProcessId), parentPid: Number(record.ParentProcessId), command }];
    });
  }
  const { stdout } = await exec('ps', ['-axo', 'pid=,ppid=,command='], { timeout: 5_000, maxBuffer: 5_000_000 });
  return parsePosixProcesses(stdout);
}

function processEvent(match: ProcessMatch, status: 'running' | 'stopped'): AgentEvent {
  return {
    schemaVersion: 1, id: randomUUID(), sessionId: `process:${match.pid}`, provider: match.provider,
    type: 'lifecycle', occurredAt: new Date().toISOString(), confidence: 'inferred',
    workspace: { label: vscode.workspace.name ?? match.terminalName },
    payload: { status, terminal: match.terminalName, processId: match.pid }
  };
}
