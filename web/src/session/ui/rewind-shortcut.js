// Esc Esc (double-Escape) opens the fork/rewind palette, like Claude Code.
let last = 0;
export function installRewindShortcut(win = window) {
  const onKey = (e) => {
    if (e.key !== 'Escape') { last = 0; return; }
    const now = Date.now();
    if (now - last < 400) {
      last = 0;
      win.dispatchEvent(new CustomEvent('pi-open-fork'));
    } else {
      last = now;
    }
  };
  win.addEventListener('keydown', onKey);
  return () => win.removeEventListener('keydown', onKey);
}
