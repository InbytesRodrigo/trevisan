const KEY = 'grupotrevisan_chat_session';
const DAY = 24 * 60 * 60 * 1000;

export function readChatSession() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (data?.id && data?.visitorKey && Number(data.expiresAt) > Date.now()) return data;
    localStorage.removeItem(KEY);
  } catch { try { localStorage.removeItem(KEY); } catch {} }
  return null;
}

export function saveChatSession(data) {
  const previous = readChatSession();
  const next = { ...previous, ...data, expiresAt: previous?.expiresAt || Date.now() + DAY };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function clearChatSession() {
  try { localStorage.removeItem(KEY); } catch {}
}
