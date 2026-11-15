import { describe, expect, it } from 'vitest';
import { groupToolRuns, pureToolCalls } from './tool-groups.js';

const call = (name, id, args = {}) => ({ type: 'toolCall', id, name, arguments: args });
const assistant = (calls, extra = []) => ({
  type: 'message',
  id: 'a' + Math.random().toString(36).slice(2),
  message: { role: 'assistant', content: [...extra, ...calls.map((c) => call(c.name, c.id, c.args))] },
});
const user = (text) => ({
  type: 'message',
  id: 'u' + Math.random().toString(36).slice(2),
  message: { role: 'user', content: text },
});

describe('pureToolCalls', () => {
  it('accepts assistant entries with only toolCall blocks', () => {
    const e = assistant([{ name: 'bash', id: 'c1' }]);
    expect(pureToolCalls(e)).toHaveLength(1);
  });
  it('rejects mixed text+call entries', () => {
    const e = assistant([{ name: 'bash', id: 'c1' }], [{ type: 'text', text: 'rodando' }]);
    expect(pureToolCalls(e)).toBeNull();
  });
  it('rejects user and toolResult entries', () => {
    expect(pureToolCalls(user('oi'))).toBeNull();
    expect(pureToolCalls({ type: 'message', message: { role: 'toolResult' } })).toBeNull();
  });
});

describe('groupToolRuns', () => {
  it('merges consecutive same-kind tool entries into one run', () => {
    const items = groupToolRuns([
      user('roda isso'),
      assistant([{ name: 'bash', id: 'c1' }]),
      assistant([{ name: 'bash', id: 'c2' }]),
      assistant([{ name: 'bash', id: 'c3' }]),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('entry');
    expect(items[1].type).toBe('toolRun');
    expect(items[1].kind).toBe('bash');
    expect(items[1].entries).toHaveLength(3);
    expect(items[1].calls).toHaveLength(3);
  });

  it('splits the run when the tool kind changes', () => {
    const items = groupToolRuns([
      assistant([{ name: 'bash', id: 'c1' }]),
      assistant([{ name: 'bash', id: 'c2' }]),
      assistant([{ name: 'read', id: 'r1' }]),
      assistant([{ name: 'read', id: 'r2' }]),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe('bash');
    expect(items[1].kind).toBe('read');
  });

  it('keeps runs of one as plain entries', () => {
    const items = groupToolRuns([
      assistant([{ name: 'bash', id: 'c1' }]),
      user('ok'),
      assistant([{ name: 'bash', id: 'c2' }]),
    ]);
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.type === 'entry')).toBe(true);
  });

  it('breaks the run on a mixed (text+call) entry', () => {
    const items = groupToolRuns([
      assistant([{ name: 'bash', id: 'c1' }]),
      assistant([{ name: 'bash', id: 'c2' }], [{ type: 'text', text: 'explicando' }]),
      assistant([{ name: 'bash', id: 'c3' }]),
    ]);
    expect(items.filter((i) => i.type === 'toolRun')).toHaveLength(0);
  });
});
