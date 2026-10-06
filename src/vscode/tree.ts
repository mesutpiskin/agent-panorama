import * as vscode from 'vscode';
import type { AdapterCapability, AgentSession } from '../domain/model.js';

type Node = { kind: 'workspace'; label: string } | { kind: 'provider'; label: string; workspace: string } | { kind: 'session'; session: AgentSession } | { kind: 'capability'; capability: AdapterCapability };

const statusIcon: Record<AgentSession['status'], string> = {
  starting: 'loading~spin', running: 'sync~spin', waiting: 'bell-dot', completed: 'pass-filled', failed: 'error', stopped: 'debug-stop', unknown: 'question'
};

export class SessionsTree implements vscode.TreeDataProvider<Node> {
  readonly #change = new vscode.EventEmitter<Node | undefined | void>();
  readonly onDidChangeTreeData = this.#change.event;
  #sessions: readonly AgentSession[] = [];
  #capabilities: readonly AdapterCapability[] = [];

  update(sessions: readonly AgentSession[], capabilities: readonly AdapterCapability[]): void { this.#sessions = sessions; this.#capabilities = capabilities; this.#change.fire(); }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === 'workspace') { const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Expanded); item.iconPath = new vscode.ThemeIcon('root-folder'); return item; }
    if (node.kind === 'provider') { const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Expanded); item.iconPath = new vscode.ThemeIcon('hubot'); return item; }
    if (node.kind === 'capability') {
      const item = new vscode.TreeItem(node.capability.label, vscode.TreeItemCollapsibleState.None);
      item.description = node.capability.installed ? node.capability.detail : 'not detected'; item.tooltip = node.capability.detail;
      item.iconPath = new vscode.ThemeIcon(node.capability.installed ? 'plug' : 'circle-slash'); return item;
    }
    const session = node.session; const item = new vscode.TreeItem(session.id, vscode.TreeItemCollapsibleState.None);
    item.id = session.id; item.contextValue = 'agentPanorama.session'; item.description = `${session.status} · ${relative(session.updatedAt)}`;
    item.tooltip = new vscode.MarkdownString(`**${session.provider}** · ${session.status}\n\nConfidence: ${session.confidence}\n\nLast activity: ${session.updatedAt}`);
    item.iconPath = new vscode.ThemeIcon(statusIcon[session.status]); item.command = { command: 'agentPanorama.showDetails', title: 'Show Session Details', arguments: [session] };
    return item;
  }

  getChildren(node?: Node): Node[] {
    if (!node) {
      const workspaces = [...new Set(this.#sessions.map(s => s.workspaceLabel ?? 'Unassigned'))];
      return workspaces.length ? workspaces.map(label => ({ kind: 'workspace', label })) : this.#capabilities.map(capability => ({ kind: 'capability', capability }));
    }
    if (node.kind === 'workspace') {
      const providers = [...new Set(this.#sessions.filter(s => (s.workspaceLabel ?? 'Unassigned') === node.label).map(s => s.provider))];
      return providers.map(label => ({ kind: 'provider', label, workspace: node.label }));
    }
    if (node.kind === 'provider') return this.#sessions.filter(s => (s.workspaceLabel ?? 'Unassigned') === node.workspace && s.provider === node.label).map(session => ({ kind: 'session', session }));
    return [];
  }
}

function relative(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return `${seconds}s ago`; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; return `${Math.floor(seconds / 3600)}h ago`;
}
