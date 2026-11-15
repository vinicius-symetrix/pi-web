<script>
  import { icon, Paperclip } from '../../../shared/icons.js';
  import { t } from '../../../shared/i18n.js';
  import { ChatToolbarState } from './chat-toolbar-state.svelte.js';
  import ContextUsage from './ContextUsage.svelte';
  import MicButton from './MicButton.svelte';

  let { chatAvailable = true, toolbar = new ChatToolbarState(), modelLabel = '', sessionId = '' } = $props();

  const statusText = $derived(
    toolbar.statusText || (chatAvailable ? t('composer.idle') : t('composer.unavailable')),
  );

  let compacting = $state(false);
  async function compactSession() {
    if (!sessionId || compacting) return;
    compacting = true;
    try {
      await fetch('/api/compact?id=' + encodeURIComponent(sessionId), { method: 'POST' });
    } finally {
      compacting = false;
    }
  }
</script>

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG and rendered session markdown -->

<div class="pi-chat-toolbar">
  <div class="pi-chat-toolbar-left">
    <button
      type="button"
      id="pi-chat-attach"
      class="pi-chat-icon-button pi-chat-photo-button"
      title={t('composer.attachPhotos')}
      aria-label={t('composer.attachPhotos')}
      disabled={!chatAvailable}>{@html icon(Paperclip, { size: 15 })}</button
    >
    <MicButton disabled={!chatAvailable} />
    <span id="pi-chat-status" class="pi-chat-status {toolbar.statusClass}"><span class="pi-chat-status-dot" aria-hidden="true"></span>{statusText}</span>
    <button
      type="button"
      id="pi-chat-thinking-label"
      class="pi-chat-thinking-label {toolbar.thinkingLevel
        ? 'thinking-' + toolbar.thinkingLevel
        : ''}"
      style:display={toolbar.thinkingLevel ? '' : 'none'}
      title={t('composer.switchEffort')}
      disabled={!chatAvailable}>{toolbar.thinkingLevel}</button
    >
    <button
      type="button"
      id="pi-chat-model-label"
      class="pi-chat-model-label"
      title={t('composer.switchModel')}
      style:display={chatAvailable ? '' : 'none'}
      disabled={!chatAvailable}
      >{toolbar.modelLabel || modelLabel || t('composer.modelPlaceholder')}</button
    >
    <ContextUsage />
    <button
      type="button"
      id="pi-chat-compact"
      class="pi-chat-compact"
      title={t('composer.compactHint')}
      aria-label={t('composer.compactHint')}
      onclick={compactSession}
      disabled={compacting || !chatAvailable}>{compacting ? t('composer.compacting') : t('composer.compact')}</button
    >
  </div>
  <div class="actions">
    <button
      type="button"
      id="pi-chat-cancel"
      class="pi-chat-cancel"
      style:display={toolbar.isRunning ? '' : 'none'}
      title={t('composer.cancelRunning')}
      aria-label={t('composer.cancelRunning')}
      disabled={toolbar.statusText === 'cancelling' || !chatAvailable}
      >{t('composer.cancel')}</button
    >
    <button
      type="button"
      id="pi-chat-queue"
      class="pi-chat-queue"
      style:display={toolbar.isRunning ? '' : 'none'}
      title={t('composer.queueHint')}
      disabled>{t('composer.queue')}</button
    >
    <button type="submit" id="pi-chat-send" class="pi-chat-send" disabled
      >{toolbar.isRunning ? t('composer.steer') : t('composer.send')}</button
    >
  </div>
</div>
