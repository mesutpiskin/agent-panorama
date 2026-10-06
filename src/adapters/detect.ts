import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AdapterCapability } from '../domain/model.js';

const exec = promisify(execFile);

async function commandExists(command: string): Promise<boolean> {
  try { await exec(process.platform === 'win32' ? 'where' : 'which', [command], { timeout: 2_000 }); return true; } catch { return false; }
}

export async function detectAdapters(extensionIds: ReadonlySet<string>): Promise<AdapterCapability[]> {
  const [claude, codex] = await Promise.all([commandExists('claude'), commandExists('codex')]);
  const copilot = extensionIds.has('github.copilot') || extensionIds.has('github.copilot-chat');
  return [
    { id: 'litellm', label: 'LiteLLM', installed: true, fidelity: 'exact', detail: 'Ready for authenticated callback events.' },
    { id: 'claude', label: 'Claude Code', installed: claude, fidelity: claude ? 'inferred' : 'unknown', detail: claude ? 'CLI detected. Hook setup is documented.' : 'Claude CLI was not found in PATH.' },
    { id: 'codex', label: 'Codex CLI', installed: codex, fidelity: codex ? 'inferred' : 'unknown', detail: codex ? 'CLI detected. Events can be sent through the ingestion API.' : 'Codex CLI was not found in PATH.' },
    { id: 'copilot', label: 'GitHub Copilot', installed: copilot, fidelity: 'unknown', detail: copilot ? 'Official extension detected; public session telemetry is not currently exposed.' : 'Official Copilot extension was not found.' }
  ];
}
