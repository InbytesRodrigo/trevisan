import { api } from './api.js';

const KEY = 'grupotrevisan_chat_session';
const DAY = 24 * 60 * 60 * 1000;
let creatingSession;
let memorySession = null;

export function readChatSession() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (data?.id && data?.visitorKey && Number(data.expiresAt) > Date.now()) { memorySession = data; return data; }
    localStorage.removeItem(KEY);
  } catch { try { localStorage.removeItem(KEY); } catch {} }
  if (memorySession?.id && memorySession?.visitorKey && Number(memorySession.expiresAt) > Date.now()) return memorySession;
  memorySession = null;
  return null;
}

export function saveChatSession(data) {
  const previous = readChatSession();
  const next = { ...previous, ...data, expiresAt: previous?.expiresAt || Date.now() + DAY };
  memorySession = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function clearChatSession() {
  memorySession = null;
  try { localStorage.removeItem(KEY); } catch {}
}

export async function ensureChatSession() {
  const saved = readChatSession();
  if (saved) return saved;
  if (!creatingSession) {
    creatingSession = api('/api/chats', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ visitorName: 'Visitante', visitorPage: window.location.pathname }),
    }).then((created) => saveChatSession(created)).finally(() => { creatingSession = null; });
  }
  return creatingSession;
}
