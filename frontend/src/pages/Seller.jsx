import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useLeadFeed } from '../useLeadFeed.js';

function statusOf(chat) {
  if (!isLead(chat)) return 'visitor';
  if (chat.computedStatus) return chat.computedStatus;
  if (chat.status === 'closed' || chat.status === 'new') return chat.status;
  return chat.unreadSeller ? 'waiting' : 'open';
}

const isLead = (chat) => Boolean(chat.lastVisitorAt || chat.visitorPhone || chat.visitorEmail);
const isOnline = (chat) => Number(chat.lastSeenAt) > Date.now() - 45000;
const statusNames = { visitor: 'Visitante', new: 'Novo', waiting: 'Aguardando', overdue: 'Precisa de atenção', open: 'Em atendimento', closed: 'Encerrado' };
const time = (value) => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const whatsappFor = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}` : '';
};

export default function Seller({ embedded = false, sharedFeed = null }) {
  const { user, logout } = useApp();
  const nav = useNavigate();
  const localFeed = useLeadFeed(!sharedFeed);
  const feed = sharedFeed || localFeed;
  const { chats, formLeads = [] } = feed;
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const box = useRef(null);
  const activeRef = useRef(null);
  const readingRef = useRef(false);
  const selectionRef = useRef(0);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    const selected = chats.find((item) => item.id === activeRef.current?.id);
    if (selected) {
      setActive(selected);
      activeRef.current = selected;
    }
  }, [chats]);

  useEffect(() => {
    if (!active?.id) return undefined;
    let mounted = true;
    const chatId = active.id;
    const refreshMessages = async () => {
      try {
        const history = await api(`/api/chats/${chatId}/messages`);
        if (!mounted || activeRef.current?.id !== chatId) return;
        setMessages((current) => {
          const combined = new Map(current.filter((item) => item.chatId === chatId).map((item) => [item.id, item]));
          history.forEach((item) => combined.set(item.id, item));
          return [...combined.values()].sort((a, b) => a.createdAt - b.createdAt);
        });
        if (document.visibilityState === 'visible' && activeRef.current.unreadSeller > 0 && !readingRef.current) {
          readingRef.current = true;
          try {
            const updated = await api(`/api/chats/${chatId}/read`, { method: 'POST' });
            if (mounted && activeRef.current?.id === chatId) {
              activeRef.current = updated;
              setActive(updated);
              feed.refresh();
            }
          } finally { readingRef.current = false; }
        }
        setError('');
      } catch (cause) { if (mounted) setError(cause.message); }
    };
    refreshMessages();
    const timer = setInterval(refreshMessages, 2000);
    const wake = () => { if (document.visibilityState === 'visible') refreshMessages(); };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => { mounted = false; clearInterval(timer); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  }, [active?.id, feed.refresh]);

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [messages]);

  const openChat = async (chat) => {
    const selection = ++selectionRef.current;
    setActive(chat);
    activeRef.current = chat;
    setMessages([]);
    try {
      const history = await api('/api/chats/' + chat.id + '/messages');
      if (selection !== selectionRef.current) return;
      setMessages(history);
      const updated = await api('/api/chats/' + chat.id + '/read', { method: 'POST' });
      if (selection !== selectionRef.current) return;
      setActive(updated);
      activeRef.current = updated;
      feed.refresh();
      setError('');
    } catch (cause) { if (selection === selectionRef.current) setError(cause.message); }
  };

  const assign = async () => {
    if (!active) return;
    try {
      const updated = await api('/api/chats/' + active.id + '/assign', { method: 'POST' });
      setActive(updated);
      activeRef.current = updated;
      feed.refresh();
      return updated;
    } catch (cause) { setError(cause.message); return null; }
  };

  const closeChat = async () => {
    if (!active) return;
    try {
      const updated = await api('/api/chats/' + active.id + '/close', { method: 'POST' });
      setActive(updated);
      activeRef.current = updated;
      feed.refresh();
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
      feed.refresh();
      setError('');
    } catch (cause) { setText(value); setError(cause.message); }
  };

  const list = useMemo(() => chats.filter((chat) => {
    const status = statusOf(chat);
    const match = !query || [chat.visitorName, chat.visitorPhone, chat.visitorEmail].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
    return match && (filter === 'all' || (filter === 'mine' ? chat.assignedTo === user?.id : filter === 'online' ? isOnline(chat) : status === filter));
  }).sort((a, b) => (isLead(b) ? b.lastMessageAt : b.lastSeenAt || b.createdAt) - (isLead(a) ? a.lastMessageAt : a.lastSeenAt || a.createdAt)), [chats, filter, query, user?.id]);

  const visibleForms = useMemo(() => {
    if (filter !== 'all' && filter !== 'forms') return [];
    const term = query.toLocaleLowerCase('pt-BR');
    return formLeads.filter((lead) => !term || [lead.firstName, lead.lastName, lead.company, lead.phone, lead.email]
      .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term)));
  }, [formLeads, filter, query]);

  const counts = {
    all: chats.length + formLeads.length,
    forms: formLeads.length,
    online: chats.filter(isOnline).length,
    new: chats.filter((chat) => isLead(chat) && statusOf(chat) === 'new').length,
    waiting: chats.filter((chat) => statusOf(chat) === 'waiting').length,
    overdue: chats.filter((chat) => statusOf(chat) === 'overdue').length,
  };

  return <div className={'inbox lead-inbox' + (embedded ? ' inbox-embedded' : '') + (active ? ' has-active-chat' : '')}>
    {feed.notice && <div className="popup lead-popup" role="status"><strong>{feed.notice}</strong><div>Abra a conversa para ver os dados e responder.</div></div>}
    <div className="inbox-list">
      <header><div><small>CENTRAL DE ATENDIMENTO</small><strong>Leads e conversas</strong><span className={'lead-live' + (feed.error ? ' offline' : '')}><i /> {feed.error ? 'Conexão indisponível' : 'Atualização automática'}</span></div><div className="lead-head-actions"><button className={'lead-sound-toggle' + (feed.soundReady ? ' on' : '')} type="button" onClick={feed.soundReady ? feed.disableSound : feed.enableSound}>{feed.soundReady ? '🔊 Som ligado' : '🔔 Ativar som'}</button>{!embedded && <span><Link to="/">Site</Link><button className="chip" type="button" onClick={() => { logout(); nav('/login'); }}>Sair</button></span>}</div></header>
      <div className="lead-overview"><div><strong>{counts.online}</strong><span>no site agora</span></div><div><strong>{counts.new}</strong><span>novos leads</span></div><div><strong>{counts.forms}</strong><span>formulários</span></div></div>
      <div className="lead-list-tools"><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar nome, telefone ou e-mail" aria-label="Buscar leads" /><div className="filters">{[['all', 'Todos ' + counts.all], ['online', 'No site ' + counts.online], ['new', 'Novos ' + counts.new], ['forms', 'Formulário ' + counts.forms], ['waiting', 'Aguardando ' + counts.waiting], ['overdue', 'Atrasados ' + counts.overdue], ['mine', 'Meus']].map(([key, label]) => <button key={key} type="button" className={'chip' + (filter === key ? ' on' : '')} onClick={() => setFilter(key)}>{label}</button>)}</div></div>
      <div className="lead-list-scroll">
      {feed.formsError && (filter === 'all' || filter === 'forms') && <p className="lead-error" role="alert">Não foi possível carregar os contatos do formulário. <button type="button" onClick={feed.refreshForms}>Tentar novamente</button></p>}
      {visibleForms.length > 0 && <div className="lead-form-group"><strong>Solicitações recebidas</strong>{visibleForms.map((lead) => <details className="lead-form-card" key={lead.id}><summary><span className="lead-form-name">{[lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Contato pelo formulário'}</span><span className="lead-tag">NOVO LEAD</span><small>{time(lead.createdAt)}</small></summary><div className="lead-form-info">{lead.company && <p><b>Empresa:</b> {lead.company}</p>}{lead.phone && <p><b>Telefone:</b> {lead.phone}</p>}{lead.email && <p><b>E-mail:</b> {lead.email}</p>}{lead.pillar && <p><b>Interesse:</b> {lead.pillar}</p>}{lead.message && <p><b>Mensagem:</b> {lead.message}</p>}<div className="lead-form-actions">{lead.phone && <a href={whatsappFor(lead.phone)} target="_blank" rel="noopener noreferrer">Responder no WhatsApp ↗</a>}{lead.email && <a href={`mailto:${lead.email}`}>Responder por e-mail ↗</a>}</div></div></details>)}</div>}
      {list.map((chat) => <button type="button" key={chat.id} className={'conv lead-conv ' + statusOf(chat) + (active?.id === chat.id ? ' active' : '')} onClick={() => openChat(chat)}>
        <span className="cw-av">{(chat.visitorName || 'V').slice(0, 1).toUpperCase()}</span>
        <span className="conv-meta"><span className="lead-conv-line"><b>{chat.visitorName || 'Visitante'}</b>{chat.unreadSeller > 0 && <span className="badge">{chat.unreadSeller}</span>}</span><span className={'lead-tag' + (!isLead(chat) ? ' visitor-tag' : '')}>{isLead(chat) ? 'NOVO LEAD' : 'VISITANTE'}</span><span className="lead-status">{isOnline(chat) ? '● No site agora' : statusNames[statusOf(chat)]}</span><p>{chat.lastMessage || (isOnline(chat) ? 'Navegando no site · Envie uma mensagem' : 'Visitou o site')}</p><small>{time(isLead(chat) ? chat.lastMessageAt : chat.lastSeenAt || chat.createdAt)}</small></span>
      </button>)}{!list.length && !visibleForms.length && <p className="lead-empty">Nenhum contato neste filtro.</p>}</div>
    </div>
    <div className="thread lead-thread">{active ? <>
      <div className="thread-head"><button className="seller-back" type="button" onClick={() => { selectionRef.current += 1; setActive(null); }} aria-label="Voltar às conversas">←</button><div className="lead-thread-title"><span className={'lead-tag' + (!isLead(active) ? ' visitor-tag' : '')}>{isLead(active) ? 'NOVO LEAD' : 'VISITANTE'}</span><strong>{active.visitorName || 'Visitante'}</strong><small>Entrou em {time(active.createdAt)} · {isOnline(active) ? 'No site agora' : 'Fora do site'}</small></div><div className="lead-thread-actions">{!active.assignedTo && <button className="btn" type="button" onClick={assign}>Atender</button>}{active.status !== 'closed' && <button className="btn ghost" type="button" onClick={closeChat}>Encerrar</button>}</div></div>
      <div className="lead-mobile-details"><strong>{isLead(active) ? 'Dados do lead' : 'Visitante do site'}</strong><span>{active.visitorPhone || 'Telefone não informado'}</span><span>{active.visitorEmail || 'E-mail não informado'}</span><span>{active.visitorPage || '/'}</span><span>Última visita: {time(active.lastSeenAt)}</span></div>
      <div className="thread-body" ref={box}>{messages.map((message) => <div key={message.id} className={'bubble ' + (message.from === 'seller' ? 'mine' : 'theirs')}>{message.text && <span>{message.text}</span>}{message.audioUrl && <audio controls preload="none" src={message.audioUrl} aria-label="Mensagem de áudio" />}<time>{message.senderName} · {time(message.createdAt)}</time></div>)}</div>
      {(error || feed.error) && <p className="lead-error" role="alert">{error || feed.error}</p>}
      <form className="cw-send" onSubmit={send}><input value={text} onChange={(event) => setText(event.target.value)} placeholder={isLead(active) ? 'Responder ao lead' : 'Iniciar conversa com o visitante'} aria-label="Enviar mensagem" /><button type="submit" disabled={!text.trim()} aria-label="Enviar resposta">➤</button></form>
    </> : <div className="lead-placeholder"><span>✦</span><h2>Seus leads em um só lugar</h2><p>Selecione uma conversa para ver os dados do contato e responder.</p>{(error || feed.error) && <p className="lead-error" role="alert">{error || feed.error}</p>}</div>}</div>
    {active && <aside className="lead-details"><span className={'lead-tag' + (!isLead(active) ? ' visitor-tag' : '')}>{isLead(active) ? 'NOVO LEAD' : 'VISITANTE'}</span><h3>Dados do contato</h3><dl><dt>Nome</dt><dd>{active.visitorName || 'Visitante'}</dd><dt>Telefone</dt><dd>{active.visitorPhone ? <a href={'tel:' + active.visitorPhone.replace(/\D/g, '')}>{active.visitorPhone}</a> : 'Não informado'}</dd><dt>E-mail</dt><dd>{active.visitorEmail ? <a href={'mailto:' + active.visitorEmail}>{active.visitorEmail}</a> : 'Não informado'}</dd><dt>Página atual</dt><dd>{active.visitorPage || 'Site'}</dd><dt>Data e hora da entrada</dt><dd>{time(active.createdAt)}</dd><dt>Última visita</dt><dd>{time(active.lastSeenAt)}</dd><dt>Última mensagem</dt><dd>{active.lastMessage ? time(active.lastMessageAt) : '—'}</dd><dt>Presença</dt><dd className={isOnline(active) ? 'lead-presence online' : 'lead-presence'}>{isOnline(active) ? '● Visitando agora' : 'Fora do site'}</dd><dt>Status</dt><dd>{statusNames[statusOf(active)] || 'Em atendimento'}</dd><dt>Atendente</dt><dd>{active.assignedName || 'Ainda não atribuído'}</dd></dl>{active.visitorPhone && <a className="lead-whatsapp" href={'https://wa.me/' + active.visitorPhone.replace(/\D/g, '')} target="_blank" rel="noopener noreferrer">Chamar lead no WhatsApp ↗</a>}</aside>}
  </div>;
}
