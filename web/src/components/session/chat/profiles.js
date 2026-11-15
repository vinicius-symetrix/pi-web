// Perfis Rápido/Forte/Local — presets de modelo + thinking com fallback automático.
// ponytail: fallback = primeiro modelo do provider do perfil; troca por id quando existir.
export const CHAT_PROFILES = [
  { id: 'fast', label: '⚡ Rápido', provider: 'dgx-dual-glm53-test', modelId: '', thinking: 'low' },
  { id: 'strong', label: '💪 Forte', provider: 'claude-router', modelId: '', thinking: 'high' },
  { id: 'local', label: '🖥 Local', provider: 'dgx-dual-glm53-test', modelId: '', thinking: 'off' },
];

export function resolveProfileModel(profile, models) {
  if (!profile) return null;
  const byProvider = (models || []).filter(
    (m) => (m.provider || '') === profile.provider,
  );
  if (byProvider.length === 0) return null;
  if (profile.modelId) {
    const exact = byProvider.find(
      (m) => (m.id || m.modelId) === profile.modelId,
    );
    if (exact) return exact;
  }
  return byProvider[0];
}

export function renderProfileRow(
  profiles = CHAT_PROFILES,
  { currentModel = null, escapeHtml = String } = {},
) {
  let html = '<div class="model-profiles">';
  profiles.forEach((p) => {
    const active =
      currentModel && currentModel.provider === p.provider ? ' selected' : '';
    html +=
      `<button type="button" class="model-profile${active}" data-profile-id="${escapeHtml(p.id)}"` +
      ` data-provider="${escapeHtml(p.provider)}" data-thinking="${escapeHtml(p.thinking)}">` +
      `${escapeHtml(p.label)}</button>`;
  });
  return html + '</div>';
}
