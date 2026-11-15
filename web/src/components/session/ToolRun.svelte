<script>
  // One collapsed run of consecutive same-kind tool entries ("Terminal ×4").
  // Expanding renders the individual entries with their anchors intact.
  import { isOpen, setOpen, toolLabel, toolSummary, kindIcon } from '../../session/ui/collapse-state.js';
  import { icon } from '../../shared/icons.js';
  import SessionEntry from './SessionEntry.svelte';

  let { run, model, live = false } = $props();

  const key = $derived(`toolrun-${run.kind}-${run.entries[0]?.id}`);
  const open = $derived(isOpen(key, false));
  const count = $derived(run.entries.length);
  const label = $derived(toolLabel(run.kind));
  const lastSummary = $derived.by(() => {
    const calls = run.calls || [];
    for (let i = calls.length - 1; i >= 0; i--) {
      const s = toolSummary(calls[i].name, calls[i].arguments || {});
      if (s) return s;
    }
    return '';
  });
  function toggle() {
    setOpen(key, !open);
  }
</script>

<div class="tool-run" data-tool-kind={run.kind}>
  <button
    type="button"
    class="tool-execution {run.kind} zc-row {open ? 'zc-open' : 'zc-collapsed'} tool-run-header"
    onclick={toggle}
    aria-expanded={open}
  >
    <span class="tool-run-icon">{@html icon(kindIcon(run.kind), { size: 13 })}</span>
    <span class="tool-run-label">{label}</span>
    {#if count > 1}<span class="tool-run-count">×{count}</span>{/if}
    <span class="tool-run-summary">{lastSummary}</span>
    <span class="tool-run-chevron">▾</span>
  </button>
  {#if open}
    <div class="tool-run-children">
      {#each run.entries as entry (entry.id)}
        <SessionEntry {entry} {model} {live} />
      {/each}
    </div>
  {/if}
</div>
