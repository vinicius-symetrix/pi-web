// Per-entry extras: copy the raw message text and collapse very long
// assistant messages behind a "mostrar mais" toggle. Delegated at the
// container level (one listener) instead of per-entry buttons.
export function copyMessage(ev) {
  const btn = ev.target.closest?.('.copy-msg-btn');
  if (!btn) return false;
  const id = btn.dataset.entryId;
  const el = document.getElementById(`entry-${id}`);
  if (!el) return true;
  const text = el.innerText || '';
  navigator.clipboard?.writeText(text).then(
    () => { btn.title = 'Copiado!'; setTimeout(() => (btn.title = 'Copiar mensagem'), 1200); },
    () => {},
  );
  return true;
}

const LONG_LINES = 120;

export function collapseLong(container) {
  if (!container) return;
  for (const el of container.querySelectorAll('.assistant-text.markdown-content')) {
    if (el.dataset.collapsed === '1') continue;
    const lines = (el.innerText || '').split('\n').length;
    if (lines < LONG_LINES) continue;
    el.dataset.collapsed = '1';
    el.classList.add('msg-collapsed');
    const btn = document.createElement('button');
    btn.className = 'msg-expand-btn';
    btn.textContent = `Mostrar mais (${lines} linhas)`;
    btn.onclick = () => {
      el.classList.remove('msg-collapsed');
      btn.remove();
    };
    el.after(btn);
  }
}
