const VISITOR_KEY = 'grupotrevisan_visitor_id';
const SESSION_KEY = 'grupotrevisan_visit_session';
const memoryIds = {};

function storedId(storage, key) {
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID();
    storage.setItem(key, next);
    return next;
  } catch {
    if (!memoryIds[key]) memoryIds[key] = crypto.randomUUID();
    return memoryIds[key];
  }
}

export function trackSiteEvent(type, label = '') {
  const path = window.location.pathname;
  if (/^\/(admin|vendedor|login)(\/|$)/.test(path)) return;
  const event = {
    type, label, path,
    visitorId: storedId(localStorage, VISITOR_KEY),
    sessionId: storedId(sessionStorage, SESSION_KEY),
  };
  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {});
}

export function trackClickedItem(event) {
  const item = event.target instanceof Element ? event.target.closest('a, button') : null;
  if (!item || item.closest('.dash, .inbox, .auth-page')) return;
  const label = item.dataset.track || item.getAttribute('aria-label') || item.textContent?.trim() || item.querySelector('img')?.alt || '';
  if (label) trackSiteEvent('click', label.replace(/\s+/g, ' ').slice(0, 120));
}
