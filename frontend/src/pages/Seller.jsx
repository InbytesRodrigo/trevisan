import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 180);
  } catch {}
}

function statusOf(c) {
  if (c.computedStatus) return c.computedStatus;
  if (c.status === 'closed') return 'closed';
  if (c.status === 'new') return 'new';
  return 'open';
}

export default function Seller() {
  const { user, logout } = useApp();
  const nav = useNavigate();
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('all');
  const [popup, setPopup] = useState(null);
  const box = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    let mounted = true;
    let initialized = false;
    let previous = [];
    const refresh = async () => {
      try {
        const next = await api('/api/chats');
        if (!mounted) return;
        if (initialized) {
          const oldIds = new Set(previous.map((item) => item.id));
          const incoming = next.find((item) => !oldIds.has(item.id));
          if (incoming) {
            beep();
            setPopup({ title: 'Novo lead chegou', text: `${incoming.visitorName} iniciou um chat` });
            setTimeout(() => setPopup(null), 6000);
          }
        }
        initialized = true;
        previous = next;
        setChats(next);
        const selected = activeRef.current;
        if (selected) {
          const updated = next.find((item) => item.id === selected.id);
          if (updated) setActive(updated);
          const items = await api(`/api/chats/${selected.id}/messages`);
          if (mounted && activeRef.current?.id === selected.id) setMessages(items);
        }
      } catch {}
    };
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [messages]);

  const openChat = async (c) => {
    setActive(c);
    await api(`/api/chats/${c.id}/read`, { method: 'POST' });
    const msgs = await api(`/api/chats/${c.id}/messages`);
    setMessages(msgs);
  };

  const assign = async () => {
    if (!active) return;
    const c = await api(`/api/chats/${active.id}/assign`, { method: 'POST' });
    setActive(c);
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    const value = text.trim();
    setText('');
    try {
      const saved = await api(`/api/chats/${active.id}/messages`, { method: 'POST', body: JSON.stringify({ text: value }) });
      setMessages((prev) => prev.some((item) => item.id === saved.id) ? prev : [...prev, saved]);
    } catch { setText(value); }
  };

  const list = useMemo(() => {
    return chats.filter((c) => {
      const st = statusOf(c);
      if (filter === 'all') return true;
      if (filter === 'new') return st === 'new';
      if (filter === 'waiting') return st === 'waiting';
      if (filter === 'overdue') return st === 'overdue';
      if (filter === 'mine') return c.assignedTo === user?.id;
      return true;
    });
  }, [chats, filter, user]);

  const counts = {
    all: chats.length,
    new: chats.filter((c) => statusOf(c) === 'new').length,
    waiting: chats.filter((c) => statusOf(c) === 'waiting').length,
    overdue: chats.filter((c) => statusOf(c) === 'overdue').length,
  };

  return (
    <div className={`inbox ${active ? 'has-active-chat' : ''}`}>
      {popup && (
        <div className="popup">
          <strong>{popup.title}</strong>
          <div>{popup.text}</div>
        </div>
      )}
      <div className="inbox-list">
        <header>
          <span>{user?.name}</span>
          <span>
            <Link to="/" style={{ marginRight: 10 }}>Site</Link>
            <button className="chip" onClick={() => { logout(); nav('/login'); }}>Sair</button>
          </span>
        </header>
        <div className="filters">
          {[
            ['all', `Todos ${counts.all}`],
            ['new', `Novos ${counts.new}`],
            ['waiting', `Aguardando ${counts.waiting}`],
            ['overdue', `Atrasados ${counts.overdue}`],
            ['mine', 'Meus'],
          ].map(([k, lab]) => (
            <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{lab}</button>
          ))}
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {list.map((c) => {
            const st = statusOf(c);
            return (
              <div key={c.id} className={`conv ${st} ${active?.id === c.id ? 'active' : ''}`} onClick={() => openChat(c)}>
                <div className="cw-av" style={{ background: st === 'overdue' ? '#c0392b' : st === 'new' ? '#25d366' : st === 'waiting' ? '#f1c40f' : '#128c7e', color: '#fff', width: 42, height: 42 }}>
                  {(c.visitorName || 'V').slice(0, 1).toUpperCase()}
                </div>
                <div className="conv-meta">
                  <b>{c.visitorName} {c.unreadSeller ? <span className="badge">{c.unreadSeller}</span> : null}</b>
                  <p>{c.lastMessage || 'Novo lead'}</p>
                  <p>{c.assignedName || 'Sem atendente'} · {new Date(c.lastMessageAt || c.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            );
          })}
          {!list.length && <p style={{ padding: 16, color: '#667781' }}>Nenhum chat neste filtro.</p>}
        </div>
      </div>
      <div className="thread">
        {active ? (
          <>
            <div className="thread-head">
              <button className="seller-back" type="button" onClick={() => setActive(null)} aria-label="Voltar às conversas">←</button>
              <div>
                <strong>{active.visitorName}</strong>
                <div style={{ fontSize: 12, color: '#667781' }}>{active.visitorPhone} · {active.visitorEmail}</div>
              </div>
              <div>
                {!active.assignedTo && <button className="btn" onClick={assign}>Atender</button>}
                {active.assignedTo && <span style={{ fontSize: 13 }}>Com {active.assignedName}</span>}
              </div>
            </div>
            <div className="thread-body" ref={box}>
              {messages.map((m) => (
                <div key={m.id} className={`bubble ${m.from === 'seller' ? 'mine' : 'theirs'}`}>
                  {m.text}
                  <time>{m.senderName} · {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
              ))}
            </div>
            <form className="cw-send" onSubmit={send}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Digite uma mensagem" />
              <button type="submit">{'>'}</button>
            </form>
          </>
        ) : (
          <div style={{ margin: 'auto', color: '#667781' }}>Selecione um chat para atender em tempo real.</div>
        )}
      </div>
    </div>
  );
}
