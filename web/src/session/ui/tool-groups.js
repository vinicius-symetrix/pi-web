// Consecutive same-kind tool entries collapse into ONE "Terminal"-style run
// row instead of repeating a notice per command. Assistant entries with >=1
// toolCall block group (text-only prose stays individual); a mixed entry's
// text renders inside the run before its calls.
import { toolKind } from './collapse-state.js';

// toolCall blocks of an assistant entry, or null when the entry has none.
export function pureToolCalls(entry) {
  if (entry?.type !== 'message' || entry.message?.role !== 'assistant') return null;
  const blocks = (entry.message.content || []).filter((b) => b.type === 'toolCall');
  return blocks.length ? blocks : null;
}

// Merge consecutive same-kind tool entries into
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
