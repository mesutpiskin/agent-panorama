import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { EventStore } from './application/store.js';
import { detectAdapters } from './adapters/detect.js';
import { type AgentEvent, type AgentSession, type AdapterCapability } from './domain/model.js';
import { MonitorServer, type MonitorServerInfo } from './infrastructure/server.js';
import { loadSharedToken } from './infrastructure/sharedToken.js';
import { showSessionDetails } from './vscode/detail.js';
import { SessionsTree } from './vscode/tree.js';

let server: MonitorServer | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  if (!vscode.workspace.getConfiguration('agentPanorama').get<boolean>('enabled', true)) return;
  const output = vscode.window.createOutputChannel('AgentPanorama', { log: true });
  const tree = new SessionsTree();
  const treeView = vscode.window.createTreeView('agentPanorama.sessions', { treeDataProvider: tree, showCollapseAll: true });
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);
  statusBar.command = 'agentPanorama.showDashboard'; statusBar.name = 'AgentPanorama'; statusBar.show();
  const store = new EventStore(context.globalStorageUri.fsPath); await store.initialize();
  const retention = vscode.workspace.getConfiguration('agentPanorama').get<number>('history.retentionDays', 14);
  await store.purge(retention);
  let capabilities: AdapterCapability[] = [];
  const token = await loadSharedToken(context.globalStorageUri.fsPath);
  await context.secrets.store('agentPanorama.ingestionToken', token);

  let remoteSessions: readonly AgentSession[] | undefined;
  let info: MonitorServerInfo = { port: 39457, endpoint: 'http://127.0.0.1:39457' };
  const refresh = async (): Promise<void> => {
    const extensionIds = new Set(vscode.extensions.all.map(extension => extension.id.toLowerCase()));
    capabilities = await detectAdapters(extensionIds); const sessions = filterRecent(remoteSessions ?? store.sessions());
    tree.update(sessions, capabilities); updateStatus(statusBar, sessions);
  };

  server = new MonitorServer(store, token, changed => { void refresh(); notify(changed); });
  try {
    info = await server.start(); output.info(`Leader monitor listening on ${info.endpoint} (loopback only).`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
    server = undefined; output.info(`Connected as a client window to ${info.endpoint}.`);
    let authenticationWarningShown = false;
    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(`${info.endpoint}/v1/sessions`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 401) {
          if (!authenticationWarningShown) {
            authenticationWarningShown = true;
            output.warn('Cross-window monitor rejected this window token. Reload all VS Code windows once to finish the AgentPanorama token migration.');
            const action = await vscode.window.showWarningMessage('AgentPanorama needs all VS Code windows reloaded once to synchronize monitoring.', 'Reload Window');
            if (action === 'Reload Window') await vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
          return;
        }
        if (!response.ok) throw new Error(`Monitor returned HTTP ${response.status}`);
        authenticationWarningShown = false;
        const body = await response.json() as { data: AgentSession[] }; remoteSessions = body.data; await refresh();
      } catch (pollError) { output.warn(`Cross-window monitor unavailable: ${pollError instanceof Error ? pollError.message : 'unknown error'}`); }
    };
    const timer = setInterval(() => { void poll(); }, 5_000); context.subscriptions.push({ dispose: () => clearInterval(timer) }); await poll();
  }
  await refresh();

  const register = (command: string, callback: (...args: unknown[]) => unknown): void => { context.subscriptions.push(vscode.commands.registerCommand(command, callback)); };
  register('agentPanorama.showDashboard', () => vscode.commands.executeCommand('workbench.view.extension.agentPanorama'));
  register('agentPanorama.refresh', refresh);
  register('agentPanorama.showDetails', (value?: unknown) => {
    const session = isSession(value) ? value : undefined;
    if (session) showSessionDetails(session, store.events(session.id));
  });
  register('agentPanorama.copyEndpoint', async () => { await vscode.env.clipboard.writeText(`${info.endpoint}/v1/events`); void vscode.window.showInformationMessage('AgentPanorama ingestion endpoint copied.'); });
  register('agentPanorama.copyToken', async () => { await vscode.env.clipboard.writeText(token); void vscode.window.showWarningMessage('AgentPanorama token copied. Treat it as a local secret.'); });
  register('agentPanorama.openSettings', () => vscode.commands.executeCommand('workbench.action.openSettings', '@ext:mesutpiskin.agent-panorama'));
  register('agentPanorama.runDiagnostics', async () => {
    const lines = [`AgentPanorama 1.0.0`, `Endpoint: ${info.endpoint}`, `Sessions: ${store.sessions().length}`, ...capabilities.map(item => `${item.label}: ${item.installed ? 'detected' : 'not detected'} (${item.fidelity}) — ${item.detail}`)];
    output.info(lines.join('\n')); output.show(true); await vscode.env.clipboard.writeText(lines.join('\n'));
    void vscode.window.showInformationMessage('Sanitized diagnostics copied and shown in Output.');
  });
  register('agentPanorama.addDemoSession', async () => {
    const now = new Date().toISOString(); const id = `demo:${randomUUID().slice(0, 8)}`;
    const event: AgentEvent = { schemaVersion: 1, id: randomUUID(), sessionId: id, provider: 'demo', type: 'lifecycle', occurredAt: now, confidence: 'exact', workspace: { label: vscode.workspace.name ?? 'Demo Workspace' }, payload: { status: 'running', model: 'example-model' } };
    const response = await fetch(`${info.endpoint}/v1/events`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
    if (!response.ok) throw new Error(`Demo ingestion failed with HTTP ${response.status}`); await refresh();
  });
  register('agentPanorama.clearHistory', async () => {
    const answer = await vscode.window.showWarningMessage('Delete all local AgentPanorama history?', { modal: true }, 'Delete');
    if (answer === 'Delete') { await store.clear(); await refresh(); void vscode.window.showInformationMessage('AgentPanorama history cleared.'); }
  });

  context.subscriptions.push(treeView, statusBar, output, { dispose: () => { void server?.stop(); } });
  if (!context.globalState.get<boolean>('agentPanorama.welcomed')) {
    await context.globalState.update('agentPanorama.welcomed', true);
    const action = await vscode.window.showInformationMessage('AgentPanorama is ready. Connect LiteLLM or another agent through the local ingestion API.', 'Copy endpoint', 'Open README');
    if (action === 'Copy endpoint') await vscode.commands.executeCommand('agentPanorama.copyEndpoint');
    if (action === 'Open README') await vscode.env.openExternal(vscode.Uri.parse('https://github.com/mesutpiskin/agent-panorama#readme'));
  }
}

export async function deactivate(): Promise<void> { await server?.stop(); }

function filterRecent(sessions: readonly AgentSession[]): readonly AgentSession[] {
  const hours = vscode.workspace.getConfiguration('agentPanorama').get<number>('history.showCompletedHours', 24);
  const cutoff = Date.now() - hours * 3_600_000;
  return sessions.filter(session => !['completed', 'failed', 'stopped'].includes(session.status) || Date.parse(session.updatedAt) >= cutoff);
}

function updateStatus(item: vscode.StatusBarItem, sessions: readonly AgentSession[]): void {
  const active = sessions.filter(s => s.status === 'running' || s.status === 'starting').length;
  const waiting = sessions.filter(s => s.status === 'waiting').length; const failed = sessions.filter(s => s.status === 'failed').length;
  item.text = `$(telescope) ${active} $(bell-dot) ${waiting}${failed ? ` $(error) ${failed}` : ''}`;
  item.tooltip = `AgentPanorama — ${active} active, ${waiting} waiting, ${failed} failed`;
}

function notify(sessions: readonly AgentSession[]): void {
  const config = vscode.workspace.getConfiguration('agentPanorama.notifications');
  for (const session of sessions) {
    const message = `${session.provider} session ${session.id}`;
    if (session.status === 'waiting' && config.get<boolean>('waiting', true)) void vscode.window.showInformationMessage(`${message} is waiting for input.`);
    if (session.status === 'completed' && config.get<boolean>('completed', false)) void vscode.window.showInformationMessage(`${message} completed.`);
    if (session.status === 'failed' && config.get<boolean>('failed', true)) void vscode.window.showErrorMessage(`${message} failed.`);
  }
}

function isSession(value: unknown): value is AgentSession {
  return typeof value === 'object' && value !== null && 'id' in value && 'status' in value && 'provider' in value;
}
