import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

export function useLeadFeed(enabled = true) {
  const [chats, setChats] = useState([]);
  const [formLeads, setFormLeads] = useState([]);
  const [formsError, setFormsError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [soundReady, setSoundReady] = useState(false);
  const previousRef = useRef(null);
  const previousFormsRef = useRef(null);
  const busyRef = useRef(false);
  const audioRef = useRef(null);
  const soundReadyRef = useRef(false);
  const noticeTimerRef = useRef(null);

  const playSound = useCallback(() => {
    const context = audioRef.current;
    if (!soundReadyRef.current || !context) return;
    context.resume().then(() => {
      for (const [frequency, delay] of [[880, 0], [1175, 0.14]]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.18);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(context.currentTime + delay);
        oscillator.stop(context.currentTime + delay + 0.19);
      }
    }).catch(() => {});
  }, []);

  const enableSound = useCallback(async () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Navegador sem suporte a áudio');
      audioRef.current ||= new AudioContextClass();
      await audioRef.current.resume();
      soundReadyRef.current = true;
      setSoundReady(true);
      playSound();
    } catch { setError('O navegador bloqueou o som. Clique novamente em Ativar som.'); }
  }, [playSound]);

  const disableSound = useCallback(() => {
    soundReadyRef.current = false;
    setSoundReady(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || busyRef.current) return;
    busyRef.current = true;
    try {
      const next = await api('/api/chats');
      const seen = new Map(next.map((item) => [item.id, Number(item.lastVisitorAt) || 0]));
      if (previousRef.current) {
        const incoming = next.find((item) => item.lastVisitorAt && (
          !previousRef.current.has(item.id) || Number(item.lastVisitorAt) > previousRef.current.get(item.id)
        ));
        if (incoming) {
          const isNew = !previousRef.current.has(incoming.id) || previousRef.current.get(incoming.id) === 0;
          setNotice(`${isNew ? 'NOVO LEAD' : 'NOVA MENSAGEM'}: ${incoming.visitorName || 'Visitante'}`);
          window.clearTimeout(noticeTimerRef.current);
          noticeTimerRef.current = window.setTimeout(() => setNotice(''), 8000);
          playSound();
        }
      }
      previousRef.current = seen;
      setChats(next);
      setError('');
    } catch (cause) { setError(cause.message); }
    finally { busyRef.current = false; }
  }, [enabled, playSound]);

  const refreshForms = useCallback(async () => {
    if (!enabled) return;
    try {
      const next = await api('/api/leads');
      const items = Array.isArray(next) ? [...next].sort((a, b) => Number(b.createdAt) - Number(a.createdAt)) : [];
      if (previousFormsRef.current) {
        const incoming = items.find((item) => !previousFormsRef.current.has(item.id));
        if (incoming) {
          setNotice(`NOVO LEAD: ${[incoming.firstName, incoming.lastName].filter(Boolean).join(' ') || 'Formulário do site'}`);
          window.clearTimeout(noticeTimerRef.current);
          noticeTimerRef.current = window.setTimeout(() => setNotice(''), 8000);
          playSound();
        }
      }
      previousFormsRef.current = new Set(items.map((item) => item.id));
      setFormLeads(items);
      setFormsError('');
    } catch (cause) { setFormsError(cause.message); }
  }, [enabled, playSound]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    refreshForms();
    const timer = window.setInterval(refresh, 2000);
    const formsTimer = window.setInterval(refreshForms, 12000);
    const wake = () => { if (document.visibilityState === 'visible') { refresh(); refreshForms(); } };
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(formsTimer);
      window.clearTimeout(noticeTimerRef.current);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [enabled, refresh, refreshForms]);

  useEffect(() => () => { audioRef.current?.close().catch(() => {}); }, []);

  return { chats, formLeads, formsError, error, notice, soundReady, enableSound, disableSound, refresh, refreshForms };
}
