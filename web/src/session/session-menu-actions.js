// Network actions behind the session command menu, split out of CommandMenu so
// the component keeps only UI orchestration (open/close, toast, navigate) and
// these stay unit-testable in isolation.

const sessionUrl = (path, id) => `${path}?id=${encodeURIComponent(id)}`;

export async function renameSession(sessionId, name, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl('/api/rename-session?id=' + encodeURIComponent(sessionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'rename failed');
  return data;
}

// Fetches fresh entries — the in-memory model is stale after a live reload.
export async function loadForkEntries(sessionId, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(sessionUrl('/api/session', sessionId));
  const data = await res.json();
  return data.entries || [];
}

export async function forkSession(sessionId, entryId, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(sessionUrl('/api/fork-session', sessionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryId }),
  });
  return res.json();
}

export async function cloneSession(sessionId, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(sessionUrl('/api/clone-session', sessionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return res.json();
}

// Shared fork flow: the session menu (⋯) and the composer's "/fork" both land
// here. openModal is injected so this module stays framework-free.
export function openForkForSession(
  sessionId,
  { loadEntries = loadForkEntries, fork = forkSession, openModal = null, toast = () => {}, t = (k) => k, navigate = () => {} } = {},
) {
  return loadEntries(sessionId)
    .then((entries) => {
      const onSelect = (entryId) => {
        fork(sessionId, entryId)
          .then((data) => {
            if (data.id) navigate('/session?id=' + encodeURIComponent(data.id));
            else toast(data.error || t('menu.forkFailed'));
          })
          .catch(() => toast(t('menu.forkFailed')));
      };
      const opened = openModal ? openModal({ entries, onSelect }) : null;
      if (opened === false) toast(t('menu.noUserMessagesToFork'));
    })
    .catch(() => toast(t('menu.loadMessagesFailed')));
}
