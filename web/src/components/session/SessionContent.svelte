<script>
  // The message pane: renders the active root→leaf path from the reactive model
  // as <SessionEntry> components, replacing the navigator's imperative #messages
  // build. Keyed by entry id so navigation and live reload add/update/remove
  // entries reactively. `afterRender(container)` runs after each (re)render to
  // re-apply toggle state, lazy-highlight pending code, and scroll — concerns the
  // imperative layer still owns. Shared by the live app + the static export.
  import { getSessionModel } from '../../session/session-context.js';
  import SessionEntry from './SessionEntry.svelte';
  import ToolRun from './ToolRun.svelte';
  import { groupToolRuns } from '../../session/ui/tool-groups.js';
  import { copyMessage, collapseLong } from '../../session/ui/entry-extras.js';
  import TypingIndicator from './TypingIndicator.svelte';

  let { model = getSessionModel(), afterRender = null, live = false } = $props();

  let containerEl = $state(null);

  const groupedPath = $derived(groupToolRuns(model.activePath));

  // Re-run post-render side effects whenever the rendered path changes.
  $effect(() => {
    model.activePath;
    if (containerEl && typeof afterRender === 'function') {
      afterRender(containerEl);
    }
  });

  $effect(() => {
    if (!containerEl || !live) return;
    const onCopy = (ev) => copyMessage(ev);
    containerEl.addEventListener('click', onCopy);
    return () => containerEl.removeEventListener('click', onCopy);
  });

  $effect(() => {
    model.activePath;
    if (live) collapseLong(containerEl);
  });
</script>

<div id="messages-list" class="messages-list" bind:this={containerEl}>
  {#each groupedPath as item (item.type === 'toolRun' ? `run-${item.kind}-${item.entries[0].id}` : item.entry.id)}
    {#if item.type === 'toolRun'}
      <ToolRun run={item} {model} {live} />
    {:else}
      <SessionEntry entry={item.entry} {model} {live} />
    {/if}
  {/each}
  {#if live}<TypingIndicator running={model.running} />{/if}
</div>
