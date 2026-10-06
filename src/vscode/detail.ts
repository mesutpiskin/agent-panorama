import * as vscode from 'vscode';
import type { AgentEvent, AgentSession } from '../domain/model.js';

const escape = (value: unknown): string => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);

export function showSessionDetails(session: AgentSession, events: readonly AgentEvent[]): void {
  const panel = vscode.window.createWebviewPanel('agentPanorama.details', `AgentPanorama: ${session.id}`, vscode.ViewColumn.Active, { enableScripts: false, retainContextWhenHidden: false });
  const rows = events.map(event => `<li><time>${escape(new Date(event.occurredAt).toLocaleString())}</time><strong>${escape(event.type)}</strong><span>${escape(summary(event))}</span></li>`).join('');
  panel.webview.html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><meta name="viewport" content="width=device-width"><style>
  body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:24px;max-width:900px;margin:auto}h1{font-size:22px}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}.card,li{background:var(--vscode-editor-inactiveSelectionBackground);padding:12px;border-radius:6px}.card b{display:block;font-size:18px;margin-top:5px}ul{list-style:none;padding:0;display:grid;gap:8px}li{display:grid;grid-template-columns:180px 100px 1fr;gap:10px}time{color:var(--vscode-descriptionForeground)}@media(max-width:600px){li{grid-template-columns:1fr}}
  </style></head><body><h1>${escape(session.provider)} · ${escape(session.status)}</h1><p>Session <code>${escape(session.id)}</code> · ${escape(session.confidence)} confidence</p><section class="metrics"><div class="card">Input tokens<b>${session.inputTokens.toLocaleString()}</b></div><div class="card">Output tokens<b>${session.outputTokens.toLocaleString()}</b></div><div class="card">Reported cost<b>$${session.costUsd.toFixed(4)}</b></div><div class="card">Last activity<b>${escape(new Date(session.updatedAt).toLocaleTimeString())}</b></div></section><h2>Timeline</h2><ul>${rows || '<li>No events recorded.</li>'}</ul></body></html>`;
}

function summary(event: AgentEvent): string {
  const fields = ['status', 'model', 'tool', 'message', 'inputTokens', 'outputTokens', 'costUsd'];
  return fields.filter(field => event.payload[field] !== undefined).map(field => `${field}: ${String(event.payload[field]).slice(0, 160)}`).join(' · ') || 'Activity recorded';
}
