import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { clearChatSession, readChatSession, saveChatSession } from '../chatSession.js';

function fill(value, vars) {
  return String(value || '').replace(/\{(\w+)\}/g, (_, key) => vars[key] || '');
}

export default function ChatWidget({ onClose, settings }) {
  const s = settings || {};
  const agent = s.chatAgentName || 'Mariana';
  const role = s.chatAgentRole || 'Atendimento';
  const flow = Array.isArray(s.chatFlow) ? s.chatFlow : [];
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [activity, setActivity] = useState('');
  const [error, setError] = useState('');
  const [contact, setContact] = useState({ phone: '', email: '' });
  const box = useRef(null);
  const widget = useRef(null);
  const chatRef = useRef(null);
  const stepRef = useRef(0);
  const waitingRef = useRef(null);
  const busyRef = useRef(false);
  const varsRef = useRef({ name: '' });
  const aliveRef = useRef(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    const syncViewport = () => {
      if (!widget.current) return;
      widget.current.style.setProperty('--chat-visual-height', `${Math.round(viewport?.height || window.innerHeight)}px`);
      widget.current.style.setProperty('--chat-visual-top', `${Math.round(viewport?.offsetTop || 0)}px`);
    };
    document.body.classList.add('chat-open');
    syncViewport();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);
    return () => {
      document.body.classList.remove('chat-open');
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
    };
  }, []);

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [messages, activity]);

  const persist = () => {
    if (!chatRef.current) return;
    saveChatSession({
      id: chatRef.current.id,
      visitorKey: chatRef.current.visitorKey,
      step: stepRef.current,
      waiting: waitingRef.current,
      vars: varsRef.current,
    });
  };

  const sendMessage = (payload) => api(`/api/chats/${chatRef.current.id}/messages`, {
    method: 'POST',
    auth: false,
    headers: { 'x-visitor-key': chatRef.current.visitorKey },
    body: JSON.stringify(payload),
  });

  const runFlow = async () => {
    if (!aliveRef.current || busyRef.current || waitingRef.current || stepRef.current >= flow.length) return;
    const index = stepRef.current;
    const step = flow[index];
    busyRef.current = true;
    const audioUrl = step.kind === 'audio' ? String(step.audioUrl || '') : '';
    setActivity(audioUrl ? 'recording' : 'typing');
    await new Promise((resolve) => setTimeout(resolve, Math.max(400, Number(step.typingMs) || 1200)));
    if (!aliveRef.current) return;
    setActivity('');
    const body = fill(step.text, varsRef.current).trim();
    try {
      if (body || audioUrl) {
        const saved = await sendMessage({ text: body, audioUrl, automated: true, flowStepId: String(step.id || index), senderName: agent });
        if (!aliveRef.current) return;
        setMessages((current) => current.some((item) => item.id === saved.id) ? current : [...current, saved]);
      }
      stepRef.current = index + 1;
      waitingRef.current = step.waitFor && step.waitFor !== 'none' ? step.waitFor : null;
      persist();
      busyRef.current = false;
      if (!waitingRef.current && stepRef.current < flow.length) setTimeout(runFlow, 350);
    } catch {
      busyRef.current = false;
      setError('Não foi possível enviar a mensagem. Tentando novamente...');
      if (aliveRef.current) setTimeout(runFlow, 5000);
    }
  };

  useEffect(() => {
    aliveRef.current = true;
    (async () => {
      const saved = readChatSession();
      if (saved) {
        try {
          const headers = { 'x-visitor-key': saved.visitorKey };
          const [existing, history] = await Promise.all([
            api(`/api/chats/${saved.id}`, { headers, auth: false }),
            api(`/api/chats/${saved.id}/messages`, { headers, auth: false }),
          ]);
          if (!aliveRef.current) return;
          chatRef.current = { ...existing, visitorKey: saved.visitorKey };
          setChat(chatRef.current);
          setMessages(history);
          varsRef.current = saved.vars || { name: existing.visitorName === 'Visitante' ? '' : existing.visitorName.split(/\s+/)[0] };
          const completed = history.reduce((highest, item) => {
            const index = flow.findIndex((step, i) => String(step.id || i) === item.flowStepId);
            return index < 0 ? highest : Math.max(highest, index + 1);
          }, 0);
          stepRef.current = Math.max(Number(saved.step) || 0, completed);
          waitingRef.current = saved.waiting || null;
          persist();
          if (!waitingRef.current) setTimeout(runFlow, 350);
        } catch { clearChatSession(); }
      }
      if (chatRef.current || !aliveRef.current) return;
      const created = await api('/api/chats', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ visitorName: 'Visitante', visitorPage: window.location.pathname }),
      });
      if (!aliveRef.current) return;
      chatRef.current = created;
      setChat(created);
      persist();
      setTimeout(runFlow, 400);
    })().catch(() => setError('Não foi possível conectar. Feche e abra o chat para tentar novamente.'));

    const refreshMessages = async () => {
      const current = chatRef.current;
      if (!current || !aliveRef.current) return;
      try {
        const headers = { 'x-visitor-key': current.visitorKey };
        const [history, details] = await Promise.all([
          api(`/api/chats/${current.id}/messages`, { headers, auth: false }),
          api(`/api/chats/${current.id}`, { headers, auth: false }),
        ]);
        if (!aliveRef.current) return;
        setMessages(history);
        setChat({ ...details, visitorKey: current.visitorKey });
        setError('');
      } catch {}
    };
    const timer = setInterval(refreshMessages, 2000);
    const wake = () => { if (document.visibilityState === 'visible') refreshMessages(); };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => { aliveRef.current = false; clearInterval(timer); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  }, []);

  const send = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !chatRef.current) return;
    const wait = waitingRef.current;
    const extra = {};
    if (wait === 'name') {
      extra.visitorName = value.slice(0, 100);
      varsRef.current = { ...varsRef.current, name: value.split(/\s+/)[0] };
    }
    if (wait === 'phone') extra.visitorPhone = value;
    if (wait === 'email') extra.visitorEmail = value;
    setText('');
    try {
      const saved = await sendMessage({ text: value, senderName: varsRef.current.name || 'Visitante', ...extra });
      setMessages((current) => current.some((item) => item.id === saved.id) ? current : [...current, saved]);
      if (Object.keys(extra).length) setChat((current) => ({ ...current, ...extra }));
      setError('');
      if (wait) {
        waitingRef.current = null;
        persist();
        setTimeout(runFlow, 500);
      }
    } catch { setText(value); setError('Mensagem não enviada. Tente novamente.'); }
  };

  const shareContact = async (event) => {
    event.preventDefault();
    const phone = contact.phone.trim();
    if (!phone || !chatRef.current) return;
    try {
      const saved = await sendMessage({ text: 'Compartilhou dados para retorno.', visitorPhone: phone, visitorEmail: contact.email.trim(), senderName: varsRef.current.name || 'Visitante' });
      setMessages((current) => [...current, saved]);
      setChat((current) => ({ ...current, visitorPhone: phone, visitorEmail: contact.email.trim() }));
      setError('');
    } catch { setError('Não foi possível salvar seus dados. Tente novamente.'); }
  };

  const whatsapp = String(s.whatsapp || '').replace(/\D/g, '');
  return (
    <div className="chat-widget" ref={widget} role="dialog" aria-label="Chat online">
      <div className="cw-head">
        <img className="cw-photo" src={s.chatAgentPhoto || '/img/agent.jpg'} alt={agent} />
        <div><strong>{agent}</strong><span className="cw-status"><i className="dot on" />{chat?.assignedName ? `Atendimento · ${chat.assignedName}` : role}</span></div>
        <button className="cw-close" type="button" onClick={onClose} aria-label="Fechar">×</button>
      </div>
      <div className="cw-body" ref={box}>
        {messages.map((message) => <div key={message.id} className={`bubble ${message.from === 'visitor' ? 'mine' : 'theirs'}`}>
          {message.from !== 'visitor' && <em className="who">{message.senderName || agent}</em>}
          {message.text && <span>{message.text}</span>}
          {message.audioUrl && <audio controls preload="none" src={message.audioUrl} aria-label="Mensagem de áudio" />}
          <time>{new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
        </div>)}
        {activity && <div className="bubble theirs cw-activity"><span>{activity === 'recording' ? 'Gravando áudio' : 'Digitando'}</span><i /><i /><i /></div>}
        {chat && chat.visitorName && chat.visitorName !== 'Visitante' && !chat.visitorPhone && <form className="cw-contact" onSubmit={shareContact}>
          <strong>Quer receber um retorno?</strong>
          <p>Deixe seu telefone para nosso time continuar o atendimento.</p>
          <input type="tel" required placeholder="Telefone com DDD" value={contact.phone} onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))} />
          <input type="email" placeholder="E-mail (opcional)" value={contact.email} onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))} />
          <button type="submit">Salvar contato</button>
        </form>}
        {error && <p className="cw-error" role="alert">{error}</p>}
      </div>
      {s.chatWhatsappOption === true && whatsapp && <a className="cw-whatsapp" data-track="Chat: continuar no WhatsApp" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">Continuar no WhatsApp ↗</a>}
      <form className="cw-send" onSubmit={send}>
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder={chat ? 'Escreva sua mensagem' : 'Conectando...'} disabled={!chat} aria-label="Mensagem" />
        <button type="submit" disabled={!chat || !text.trim()} aria-label="Enviar mensagem">➤</button>
      </form>
    </div>
  );
}
