// Ctrl+F inside the open conversation: highlight matches in the rendered
// messages and jump between them. Plain text walk (no regex on HTML).
let hits = [];
let idx = -1;

function clear() {
  for (const m of hits) {
    const p = m.parentElement;
    p.replaceWith(...m.childNodes);
    p.normalize();
  }
  hits = [];
  idx = -1;
}

function walk(node, q, out) {
  if (!node) return;
  if (node.nodeType === 3) {
    const i = node.nodeValue.toLowerCase().indexOf(q);
    if (i === -1) return;
    const range = document.createRange();
    range.setStart(node, i);
    range.setEnd(node, i + q.length);
    const mark = document.createElement('mark');
    mark.className = 'search-hit';
    range.surroundContents(mark);
    out.push(mark);
    return;
  }
  if (node.nodeType !== 1 || node.classList.contains('search-hit')) return;
  for (const c of [...node.childNodes]) walk(c, q, out);
}

export function searchInPage(q, container = document.getElementById('messages-list')) {
  clear();
  if (!q || !container) return 0;
  const ql = q.toLowerCase();
  walk(container, ql, hits);
  return hits.length;
}

export function jumpNext() {
  if (!hits.length) return -1;
  hits[idx]?.classList.remove('search-hit-active');
  idx = (idx + 1) % hits.length;
  hits[idx].classList.add('search-hit-active');
  hits[idx].scrollIntoView({ block: 'center', behavior: 'smooth' });
  return idx;
}

export function jumpPrev() {
  if (!hits.length) return -1;
  hits[idx]?.classList.remove('search-hit-active');
  idx = idx <= 0 ? hits.length - 1 : idx - 1;
  hits[idx].classList.add('search-hit-active');
  hits[idx].scrollIntoView({ block: 'center', behavior: 'smooth' });
  return idx;
}

export function closeSearch() {
  clear();
}
