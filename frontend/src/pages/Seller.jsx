import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

function notifySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = 840;
    gain.gain.value = 0.06;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    setTimeout(() => { oscillator.stop(); ctx.close(); }, 180);
  } catch {}
}

function statusOf(chat) {
  if (chat.computedStatus) return chat.computedStatus;
  if (chat.status === 'closed' || chat.status === 'new') return chat.status;
  return chat.unreadSeller ? 'waiting' : 'open';
}

const statusNames = { new: 'Novo', waiting: 'Aguardando', overdue: 'Precisa de atenção', open: 'Em atendimento', closed: 'Encerrado' };
const time = (value) => new Date(value || Date.now()).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default function Seller({ embedded = false }) {
  const { user, logout, settings } = useApp();
  const nav = useNavigate();
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [popup, setPopup] = useState(null);
  const [error, setError] = useState('');
  const box = useRef(null);
  const activeRef = useRef(null);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    let mounted = true;
    let initialized = false;
    let previous = new Set();
    const refresh = async () => {
      try {
        const next = await api('/api/chats');
        if (!mounted) return;
        if (initialized) {
          const incoming = next.find((item) => !previous.has(item.id));
          if (incoming) {
            if (settings?.chatSound !== false) notifySound();
            setPopup('NOVO LEAD: ' + (incoming.visitorName || 'Visitante'));
            setTimeout(() => setPopup(null), 6000);
          }
        }
        initialized = true;
        previous = new Set(next.map((item) => item.id));
        setChats(next);
        if (activeRef.current) {
          const selected = next.find((item) => item.id === activeRef.current.id);
          if (selected) setActive(selected);
          const history = await api('/api/chats/' + activeRef.current.id + '/messages');
          if (mounted && activeRef.current?.id === selected?.id) setMessages(history);
        }
        setError('');
      } catch (cause) { if (mounted) setError(cause.message); }
    };
    refresh();
    const timer = setInterval(refresh, 4000);
    return () => { mounted = false; clearInterval(timer); };
  }, [settings?.chatSound]);

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [messages]);

  const openChat = async (chat) => {
    setActive(chat);
    activeRef.current = chat;
    try {
      const history = await api('/api/chats/' + chat.id + '/messages');
      setMessages(history);
      const updated = await api('/api/chats/' + chat.id + '/read', { method: 'POST' });
      setActive(updated);
      activeRef.current = updated;
      setError('');
    } catch (cause) { setError(cause.message); }
  };

  const assign = async () => {
    if (!active) return;
    try {
      const updated = await api('/api/chats/' + active.id + '/assign', { method: 'POST' });
      setActive(updated);
      activeRef.current = updated;
      return updated;
    } catch (cause) { setError(cause.message); return null; }
  };

  const closeChat = async () => {
    if (!active) return;
    try {
      const updated = await api('/api/chats/' + active.id + '/close', { method: 'POST' });
      setActive(updated);
      activeRef.current = updated;
    } catch (cause) { setError(cause.message); }
  };

  const send = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !active) return;
    setText('');
    try {
      if (!active.assignedTo && !(await assign())) { setText(value); return; }
      const saved = await api('/api/chats/' + active.id + '/messages', { method: 'POST', body: JSON.stringify({ text: value }) });
      setMessages((current) => current.some((item) => item.id === saved.id) ? current : [...current, saved]);
      setError('');
    } catch (cause) { setText(value); setError(cause.message); }
  };

  const list = useMemo(() => chats.filter((chat) => {
    const status = statusOf(chat);
    const match = !query || [chat.visitorName, chat.visitorPhone, chat.visitorEmail].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
    return match && (filter === 'all' || (filter === 'mine' ? chat.assignedTo === user?.id : status === filter));
  }).sort((a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt)), [chats, filter, query, user?.id]);

  const counts = {
    all: chats.length,
    new: chats.filter((chat) => statusOf(chat) === 'new').length,
    waiting: chats.filter((chat) => statusOf(chat) === 'waiting').length,
    overdue: chats.filter((chat) => statusOf(chat) === 'overdue').length,
  };

  return <div className={'inbox lead-inbox' + (embedded ? ' inbox-embedded' : '') + (active ? ' has-active-chat' : '')}>
    {popup && <div className="popup"><strong>{popup}</strong><div>Abra a conversa para ver os dados e responder.</div></div>}
    <div className="inbox-list">
      <header><div><small>CENTRAL DE ATENDIMENTO</small><strong>Leads e conversas</strong></div>{!embedded && <span><Link to="/">Site</Link><button className="chip" type="button" onClick={() => { logout(); nav('/login'); }}>Sair</button></span>}</header>
      <div className="lead-list-tools"><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar nome, telefone ou e-mail" aria-label="Buscar leads" /><div className="filters">{[['all', 'Todos ' + counts.all], ['new', 'Novos ' + counts.new], ['waiting', 'Aguardando ' + counts.waiting], ['overdue', 'Atrasados ' + counts.overdue], ['mine', 'Meus']].map(([key, label]) => <button key={key} type="button" className={'chip' + (filter === key ? ' on' : '')} onClick={() => setFilter(key)}>{label}</button>)}</div></div>
      <div className="lead-list-scroll">{list.map((chat) => <button type="button" key={chat.id} className={'conv lead-conv ' + statusOf(chat) + (active?.id === chat.id ? ' active' : '')} onClick={() => openChat(chat)}>
        <span className="cw-av">{(chat.visitorName || 'V').slice(0, 1).toUpperCase()}</span>
        <span className="conv-meta"><span className="lead-conv-line"><b>{chat.visitorName || 'Visitante'}</b>{chat.unreadSeller > 0 && <span className="badge">{chat.unreadSeller}</span>}</span><span className="lead-tag">NOVO LEAD</span><span className="lead-status">{statusNames[statusOf(chat)] || 'Em atendimento'}</span><p>{chat.lastMessage || 'Conversa iniciada'}</p><small>{time(chat.lastMessageAt || chat.createdAt)}</small></span>
      </button>)}{!list.length && <p className="lead-empty">Nenhum lead neste filtro.</p>}</div>
    </div>
    <div className="thread lead-thread">{active ? <>
      <div className="thread-head"><button className="seller-back" type="button" onClick={() => setActive(null)} aria-label="Voltar às conversas">←</button><div className="lead-thread-title"><span className="lead-tag">NOVO LEAD</span><strong>{active.visitorName || 'Visitante'}</strong><small>Iniciou em {time(active.createdAt)}</small></div><div className="lead-thread-actions">{!active.assignedTo && <button className="btn" type="button" onClick={assign}>Atender</button>}{active.status !== 'closed' && <button className="btn ghost" type="button" onClick={closeChat}>Encerrar</button>}</div></div>
      <div className="lead-mobile-details"><strong>Dados do lead</strong><span>{active.visitorPhone || 'Telefone não informado'}</span><span>{active.visitorEmail || 'E-mail não informado'}</span></div>
      <div className="thread-body" ref={box}>{messages.map((message) => <div key={message.id} className={'bubble ' + (message.from === 'seller' ? 'mine' : 'theirs')}>{message.text && <span>{message.text}</span>}{message.audioUrl && <audio controls preload="none" src={message.audioUrl} aria-label="Mensagem de áudio" />}<time>{message.senderName} · {time(message.createdAt)}</time></div>)}</div>
      {error && <p className="lead-error" role="alert">{error}</p>}
      <form className="cw-send" onSubmit={send}><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Responder ao lead" aria-label="Responder ao lead" /><button type="submit" disabled={!text.trim()} aria-label="Enviar resposta">➤</button></form>
    </> : <div className="lead-placeholder"><span>✦</span><h2>Seus leads em um só lugar</h2><p>Selecione uma conversa para ver os dados do contato e responder.</p>{error && <p className="lead-error" role="alert">{error}</p>}</div>}</div>
    {active && <aside className="lead-details"><span className="lead-tag">NOVO LEAD</span><h3>Dados do contato</h3><dl><dt>Nome</dt><dd>{active.visitorName || 'Visitante'}</dd><dt>Telefone</dt><dd>{active.visitorPhone ? <a href={'tel:' + active.visitorPhone.replace(/\D/g, '')}>{active.visitorPhone}</a> : 'Não informado'}</dd><dt>E-mail</dt><dd>{active.visitorEmail ? <a href={'mailto:' + active.visitorEmail}>{active.visitorEmail}</a> : 'Não informado'}</dd><dt>Origem</dt><dd>{active.visitorPage || 'Site'}</dd><dt>Entrou em</dt><dd>{time(active.createdAt)}</dd><dt>Status</dt><dd>{statusNames[statusOf(active)] || 'Em atendimento'}</dd><dt>Atendente</dt><dd>{active.assignedName || 'Ainda não atribuído'}</dd></dl>{active.visitorPhone && <a className="lead-whatsapp" href={'https://wa.me/' + active.visitorPhone.replace(/\D/g, '')} target="_blank" rel="noopener noreferrer">Chamar lead no WhatsApp ↗</a>}</aside>}
  </div>;
}
