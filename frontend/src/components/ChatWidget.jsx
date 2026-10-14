import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

function fill(text, vars) {
  return String(text || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] || '');
}

export default function ChatWidget({ onClose, settings }) {
  const s = settings || {};
  const brand = s.brandName || 'GrupoTrevisan';
  const agent = s.chatAgentName || 'Mariana';
  const role = s.chatAgentRole || 'Atendimento';
  const photo = s.chatAgentPhoto || '/img/agent.jpg';
  const flow = Array.isArray(s.chatFlow) && s.chatFlow.length
    ? s.chatFlow
    : [
        { text: 'Oi, esta visitando nosso site', waitFor: 'none', typingMs: 1400 },
        { text: 'Como vc se chama?', waitFor: 'name', typingMs: 1100 },
      ];

  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const box = useRef(null);
  const chatRef = useRef(null);
  const stepRef = useRef(0);
  const waitingRef = useRef(null);
  const busyRef = useRef(false);
  const varsRef = useRef({ name: '' });

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [messages, typing]);

  const pushLocal = (msg) => {
    setMessages((prev) => [...prev, msg]);
  };

  const sendMessage = (payload) => api(`/api/chats/${chatRef.current.id}/messages`, {
    method: 'POST',
    headers: { 'x-visitor-key': chatRef.current.visitorKey },
    body: JSON.stringify(payload),
  });

  const runFlow = async () => {
    if (busyRef.current) return;
    const i = stepRef.current;
    if (i >= flow.length) return;
    const step = flow[i];
    busyRef.current = true;
    const wait = Math.max(400, Number(step.typingMs) || 1200);
    setTyping(true);
    await new Promise((r) => setTimeout(r, wait));
    setTyping(false);
    const body = fill(step.text, varsRef.current);
    const msg = {
      id: `bot-${Date.now()}-${i}`,
      text: body,
      from: 'seller',
      automated: true,
      senderName: agent,
      createdAt: Date.now(),
    };
    if (chatRef.current) {
      try {
        const saved = await sendMessage({
        text: body,
        automated: true,
        senderName: agent,
        });
        setMessages((prev) => prev.some((entry) => entry.id === saved.id) ? prev : [...prev, saved]);
      } catch { pushLocal(msg); }
    } else pushLocal(msg);
    stepRef.current = i + 1;
    const waitFor = step.waitFor || 'none';
    if (waitFor === 'none') {
      busyRef.current = false;
      setTimeout(runFlow, 350);
    } else {
      waitingRef.current = waitFor;
      busyRef.current = false;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await api('/api/chats', {
        method: 'POST',
        body: JSON.stringify({ visitorName: 'Visitante' }),
      });
      if (cancelled) return;
      setChat(c);
      chatRef.current = c;
      setTimeout(runFlow, 500);
    })().catch(() => {});
    const timer = setInterval(async () => {
      const current = chatRef.current;
      if (!current) return;
      try {
        const items = await api(`/api/chats/${current.id}/messages`, { headers: { 'x-visitor-key': current.visitorKey } });
        setMessages((prev) => {
          const ids = new Set(items.map((item) => item.id));
          return [...items, ...prev.filter((item) => !ids.has(item.id) && String(item.id).startsWith('bot-'))];
        });
      } catch {}
    }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const send = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || !chatRef.current) return;
    setText('');
    const wait = waitingRef.current;
    const extra = {};
    if (wait === 'name') {
      const name = value.split(/\s+/)[0];
      const nextVars = { ...varsRef.current, name };
      varsRef.current = nextVars;
      extra.visitorName = value;
    }
    if (wait === 'phone') extra.visitorPhone = value;
    if (wait === 'email') extra.visitorEmail = value;

    try {
      const saved = await sendMessage({ text: value, senderName: varsRef.current.name || 'Visitante', ...extra });
      setMessages((prev) => prev.some((entry) => entry.id === saved.id) ? prev : [...prev, saved]);
    } catch { setText(value); return; }

    if (wait) {
      waitingRef.current = null;
      setTimeout(runFlow, 600);
    }
  };

  return (
    <div className="chat-widget">
      <div className="cw-head">
        <img className="cw-photo" src={photo} alt={agent} />
        <div>
          <strong>{agent}</strong>
          <span className="cw-status">
            <i className="dot on" />
            {chat?.assignedName ? `online · ${chat.assignedName}` : `online · ${role}`}
          </span>
        </div>
        <button className="cw-close" onClick={onClose} aria-label="Fechar">x</button>
      </div>
      <div className="cw-body" ref={box}>
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.from === 'visitor' ? 'mine' : 'theirs'}`}>
            {m.from !== 'visitor' && <em className="who">{m.senderName || agent}</em>}
            {m.text}
            <time>
              {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {m.from === 'visitor' ? '  ✓✓' : ''}
            </time>
          </div>
        ))}
        {typing && (
          <div className="bubble theirs typing">
            <span /><span /><span />
          </div>
        )}
      </div>
      <form className="cw-send" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mensagem"
          autoFocus
        />
        <button type="submit" aria-label="Enviar">{'>'}</button>
      </form>
    </div>
  );
}
