function cleanEvent(body) {
  const type = body?.type === 'pageview' ? 'pageview' : body?.type === 'click' ? 'click' : '';
  const path = String(body?.path || '').split('?')[0].slice(0, 150);
  const visitorId = String(body?.visitorId || '').slice(0, 80);
  const sessionId = String(body?.sessionId || '').slice(0, 80);
  const label = String(body?.label || '').trim().slice(0, 120);
  if (!type || !path.startsWith('/') || !visitorId || !sessionId || (type === 'click' && !label)) return null;
  if (/^\/(admin|vendedor|login)(\/|$)/.test(path)) return null;
  return { type, path, visitorId, sessionId, label: type === 'click' ? label : '', createdAt: Date.now() };
}

function analyticsRange(fromValue, toValue) {
  const to = Number(toValue) || Date.now();
  const from = Number(fromValue) || to - 7 * 86400000;
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || to - from > 366 * 86400000) return null;
  return { from, to };
}

function summarizeAnalytics(events, range) {
  const selected = events.filter((item) => item.createdAt >= range.from && item.createdAt <= range.to);
  const pageviews = selected.filter((item) => item.type === 'pageview');
  const clicks = selected.filter((item) => item.type === 'click');
  const countBy = (items, key) => Object.entries(items.reduce((all, item) => {
    const name = key(item);
    all[name] = (all[name] || 0) + 1;
    return all;
  }, {})).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
  const days = countBy(pageviews, (item) => new Date(item.createdAt).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    from: range.from,
    to: range.to,
    pageviews: pageviews.length,
    visitors: new Set(pageviews.map((item) => item.visitorId)).size,
    sessions: new Set(pageviews.map((item) => item.sessionId)).size,
    clicks: clicks.length,
    days,
    pages: countBy(pageviews, (item) => item.path).slice(0, 30),
    items: countBy(clicks, (item) => item.label).slice(0, 50),
  };
}

module.exports = { cleanEvent, analyticsRange, summarizeAnalytics };
