export interface ProcessEntry { pid: number; parentPid: number; command: string }
export interface ProcessMatch extends ProcessEntry { provider: string; terminalName: string }

export function findAgentProcesses(processes: readonly ProcessEntry[], terminals: readonly { name: string; pid: number }[]): ProcessMatch[] {
  const children = new Map<number, ProcessEntry[]>();
  for (const process of processes) children.set(process.parentPid, [...(children.get(process.parentPid) ?? []), process]);
  const matches: ProcessMatch[] = [];
  for (const terminal of terminals) {
    const visit = (parentPid: number, matchedAncestor: boolean): void => {
      for (const process of children.get(parentPid) ?? []) {
        const provider = providerFor(process.command); const matched = provider !== undefined;
        if (matched && !matchedAncestor) matches.push({ ...process, provider, terminalName: terminal.name });
        visit(process.pid, matchedAncestor || matched);
      }
    };
    visit(terminal.pid, false);
  }
  return matches;
}

export function parsePosixProcesses(output: string): ProcessEntry[] {
  return output.split('\n').map(line => /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line)).filter((match): match is RegExpExecArray => match !== null).map(match => ({ pid: Number(match[1]), parentPid: Number(match[2]), command: match[3] ?? '' }));
}

function providerFor(command: string): string | undefined {
  const executables = command.toLowerCase().split(/\s+/).map(token => {
    const normalized = token.replaceAll('\\', '/').replace(/^['"]|['"]$/g, '');
    return normalized.slice(normalized.lastIndexOf('/') + 1).replace(/\.(?:exe|cmd|bat|sh)$/, '');
  });
  if (executables.includes('claude-saka')) return 'claude-saka';
  if (executables.includes('claude-codex')) return 'claude-codex';
  if (executables.includes('claude')) return 'claude';
  if (executables.includes('codex')) return 'codex';
  return undefined;
}
