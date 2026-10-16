import React, { useEffect, useState } from 'react';
import ChatWidget from './ChatWidget.jsx';
import { readChatSession } from '../chatSession.js';

export default function ContactBubbles({ settings }) {
  const [open, setOpen] = useState(() => Boolean(readChatSession()));
  const [autoHandled, setAutoHandled] = useState(() => Boolean(readChatSession()));
  const whatsapp = String(settings?.whatsapp || '').replace(/\D/g, '');
  const chatEnabled = settings?.chatEnabled !== false;

  useEffect(() => {
    if (!chatEnabled || settings?.chatAutoOpen === false || autoHandled || open) return undefined;
    const delay = Math.max(1, Number(settings?.chatOpenDelay) || 10) * 1000;
    const timer = window.setTimeout(() => { setOpen(true); setAutoHandled(true); }, delay);
    return () => window.clearTimeout(timer);
  }, [chatEnabled, settings?.chatAutoOpen, settings?.chatOpenDelay, autoHandled, open]);

  const openChat = () => { setOpen(true); setAutoHandled(true); };
  const closeChat = () => { setOpen(false); setAutoHandled(true); };

  return <>
    {whatsapp && <a className="float-wa" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Olá! Vim pelo site do GrupoTrevisan e gostaria de falar com vocês.')}`} target="_blank" rel="noopener noreferrer" aria-label="Falar pelo WhatsApp" title="Falar pelo WhatsApp" data-track="Balão: WhatsApp">
      <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" focusable="false"><path d="M16 .8A15.1 15.1 0 0 0 3 23.6L.9 31l7.6-2A15.2 15.2 0 1 0 16 .8Zm0 27.6a12.4 12.4 0 0 1-6.3-1.7l-.5-.3-4.5 1.2 1.2-4.4-.3-.5A12.4 12.4 0 1 1 16 28.4Zm6.8-9.3c-.4-.2-2.2-1.1-2.6-1.2-.3-.1-.6-.2-.8.2-.3.4-1 1.2-1.2 1.4-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8l.6-.7.4-.6c.1-.2 0-.5 0-.7l-1.2-2.8c-.3-.7-.6-.6-.8-.6h-.7c-.3 0-.7.1-1 .5s-1.3 1.3-1.3 3.1 1.4 1.8c.2 2.3 3.2 4.9 4.1.7.6 1.3 1.1 2 1.5.8.4 1.5.6 2 .8.8.2 1.5.2 2.1.1.6-.1 2.2-.9 2.5-1.8.3-.9.3-1.7.2-1.8-.1-.2-.3-.3-.7-.5Z" /></svg>
    </a>}
    {chatEnabled && !open && <button className="float-chat" type="button" onClick={openChat} aria-label="Abrir chat ao vivo" title="Abrir chat ao vivo" data-track="Balão: Chat online"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.4-.7L3 21l1.7-5.2A8.5 8.5 0 1 1 20.5 11.5Z" /><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth="2.6" /></svg></button>}
    {chatEnabled && open && <ChatWidget onClose={closeChat} settings={settings} />}
  </>;
}
