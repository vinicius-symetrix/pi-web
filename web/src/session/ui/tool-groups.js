// Consecutive same-kind tool entries collapse into ONE "Terminal"-style run
// row instead of repeating a notice per command. Pure tool entries only:
// assistant messages whose visible content is exclusively toolCall blocks —
// mixed text+call entries stay individual so prose always renders in place.
import { toolKind } from './collapse-state.js';

// toolCall blocks of an assistant entry, or null when the entry is not a pure
// tool entry (user/assistant text, thinking-only, mixed content, toolResult).
export function pureToolCalls(entry) {
  if (entry?.type !== 'message' || entry.message?.role !== 'assistant') return null;
  const blocks = (entry.message.content || []).filter((b) => b.type !== 'thinking');
  if (!blocks.length || blocks.some((b) => b.type !== 'toolCall')) return null;
  return blocks.filter((b) => b.type === 'toolCall');
}

// Merge consecutive pure tool entries of one kind into
// { type: 'toolRun', kind, entries, calls }. Runs shorter than 2 entries stay
// plain items (the common single-command case keeps its current look).
export function groupToolRuns(entries) {
  const items = [];
  let run = null;
  const flush = () => {
    if (!run) return;
    if (run.entries.length >= 2) items.push(run);
    else for (const e of run.entries) items.push({ type: 'entry', entry: e });
    run = null;
  };
  for (const entry of entries || []) {
    const calls = pureToolCalls(entry);
    const kinds = calls ? [...new Set(calls.map((c) => toolKind(c.name)))] : null;
    if (calls && kinds.length === 1) {
      const kind = kinds[0];
      if (run && run.kind === kind) {
        run.entries.push(entry);
        run.calls.push(...calls);
      } else {
        flush();
        run = { type: 'toolRun', kind, entries: [entry], calls: [...calls] };
      }
      continue;
    }
    flush();
    items.push({ type: 'entry', entry });
  }
  flush();
  return items;
}
