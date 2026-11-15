<script>
  // "Gerando…" animado no fim da conversa enquanto o worker roda. Mostra a
  // ferramenta em andamento quando houver. Puro CSS — sem polling extra.
  import { t } from '../../shared/i18n.js';
  let { running = false, tool = '' } = $props();
</script>

{#if running}
  <div class="typing-indicator" role="status" aria-live="polite">
    <span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="typing-label">{tool ? `${tool}…` : t('composer.running') || 'Gerando…'}</span>
  </div>
{/if}
