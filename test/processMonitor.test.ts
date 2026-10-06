import { describe, expect, it } from 'vitest';
import { findAgentProcesses, parsePosixProcesses } from '../src/adapters/processDiscovery.js';

describe('terminal process discovery', () => {
  it('finds the wrapper below a VS Code terminal and suppresses its nested claude process', () => {
    const processes = parsePosixProcesses(`
      25003 9430 /bin/zsh
      26290 25003 /bin/bash /Users/me/.claude-corp/claude-saka
      27140 26290 /Users/me/.npm-global/bin/claude
      60094 1 /Applications/Codex.app/codex app-server
    `);
    expect(findAgentProcesses(processes, [{ name: 'Agent', pid: 25003 }])).toEqual([
      expect.objectContaining({ pid: 26290, provider: 'claude-saka', terminalName: 'Agent' })
    ]);
  });

  it('finds a direct codex process but ignores unrelated global processes', () => {
    const processes = parsePosixProcesses('10 1 /bin/zsh\n11 10 /usr/local/bin/codex\n20 1 /usr/bin/claude');
    expect(findAgentProcesses(processes, [{ name: 'Terminal 1', pid: 10 }]).map(value => value.pid)).toEqual([11]);
  });
});
