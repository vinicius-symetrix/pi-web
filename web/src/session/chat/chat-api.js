export function chatUrl(path, sessionId) {
  return `${path}?id=${encodeURIComponent(sessionId)}`;
}

export function cancelChat(sessionId, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/chat/cancel', sessionId), { method: 'POST' });
}

export function sendChat(sessionId, body, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/chat', sessionId), { method: 'POST', body });
}

export function getWorkerStatus(sessionId, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/worker-status', sessionId));
}

// The model list is server-static for the lifetime of the page: cache the
// first response so every session navigation (and the toolbar) reuses it
// instead of paying another round trip on slow links.
// Cache the PARSED payload (not the Response): Response bodies can only be
// read once, so two consumers (context usage + model picker) sharing a cached
// Response silently broke the second reader ("body already read") and left
// the picker empty. An empty list is never cached: the worker may still be
// warming up, and the next page should retry.
let modelsCache = null;

export function listModels({ fetchImpl = fetch } = {}) {
  if (modelsCache) return modelsCache;
  modelsCache = fetchImpl('/api/models').then(
    async (r) => {
      if (!r.ok) {
        modelsCache = null;
        return r;
      }
      const data = await r.json();
      if (!data.models || data.models.length === 0) modelsCache = null;
      return { ok: true, status: r.status, json: async () => data };
    },
    (err) => {
      modelsCache = null;
      throw err;
    },
  );
  return modelsCache;
}

export function getCommands(sessionId, { load = false } = {}, { fetchImpl = fetch } = {}) {
  const url = chatUrl('/api/commands', sessionId) + (load ? '&load=1' : '');
  return fetchImpl(url);
}

export function getFiles(sessionId, query, { signal, fetchImpl = fetch } = {}) {
  const url = chatUrl('/api/files', sessionId) + '&q=' + encodeURIComponent(query || '');
  return fetchImpl(url, { signal });
}

export function setModel(sessionId, { provider, modelId }, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/set-model', sessionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, modelId }),
  });
}

export function setThinkingLevel(sessionId, level, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/set-thinking-level', sessionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
  });
}
