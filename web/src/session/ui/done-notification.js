// Desktop notification when the worker finishes, only when the tab is not
// focused. Permission is requested on first use (lazy, no banner on load).
export function requestNotifyPermission() {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } catch {}
}

export function notifyDone(title = 'pi-web') {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (document.hasFocus()) return; // user is watching — no noise
    new Notification(title, { body: 'Resposta pronta.', tag: 'pi-web-done' });
  } catch {}
}
