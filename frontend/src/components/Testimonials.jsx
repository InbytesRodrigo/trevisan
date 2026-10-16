import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const emptyForm = { authorName: '', company: '', role: '', rating: 5, message: '', consent: false, website: '' };

function Stars({ rating }) {
  return <div className="review-stars" aria-label={`${rating} de 5 estrelas`}>{[1, 2, 3, 4, 5].map((value) => <span key={value} className={value <= rating ? 'filled' : ''} aria-hidden="true">★</span>)}</div>;
}

export default function Testimonials() {
  const [items, setItems] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const carousel = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    const refresh = () => api('/api/reviews', { auth: false }).then(setItems).catch(() => setError('Não foi possível carregar as avaliações agora.'));
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);

  useEffect(() => {
    if (formOpen) window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [formOpen]);

  const slide = (direction) => {
    const node = carousel.current;
    if (!node) return;
    const card = node.querySelector('.review-card');
    if (!card) return;
    const distance = card.getBoundingClientRect().width + 18;
    const atEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 8;
    node.scrollTo({ left: direction > 0 && atEnd ? 0 : Math.max(0, node.scrollLeft + distance * direction), behavior: 'smooth' });
  };

  useEffect(() => {
    if (items.length < 2) return undefined;
    const timer = window.setInterval(() => {
      if (document.hidden || carousel.current?.matches(':hover, :focus-within')) return;
      slide(1);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [items.length]);

  const submit = async (event) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');
    try {
      await api('/api/reviews', { method: 'POST', auth: false, body: JSON.stringify(form) });
      setForm(emptyForm);
      setFormOpen(false);
      setSent(true);
    } catch (cause) { setError(cause.message); }
    finally { setSending(false); }
  };

  return <section className="section reviews-section" id="avaliacoes">
    <div className="container">
      <div className="reviews-heading">
        <div><span className="reviews-eyebrow">EXPERIÊNCIAS REAIS</span><h2>O que as empresas dizem sobre nós</h2><p>Avaliações publicadas após análise da nossa equipe.</p></div>
        <button className="btn review-add-button" type="button" onClick={() => { setFormOpen((value) => !value); setSent(false); }}>Deixe sua avaliação <span>→</span></button>
      </div>
      {items.length > 0 ? <div className="reviews-carousel-wrap">
        <div className="reviews-carousel" ref={carousel} aria-label="Avaliações de clientes">
          {items.map((item) => <article className="review-card" key={item.id}>
            <Stars rating={item.rating} />
            <p className="review-quote">“{item.message}”</p>
            <div className="review-author"><span className="review-avatar" aria-hidden="true">{item.company.slice(0, 2).toUpperCase()}</span><div><strong>{item.authorName}</strong><small>{item.role ? `${item.role} · ` : ''}{item.company}</small></div></div>
          </article>)}
        </div>
        {items.length > 1 && <div className="reviews-controls"><button type="button" onClick={() => slide(-1)} aria-label="Avaliação anterior">←</button><button type="button" onClick={() => slide(1)} aria-label="Próxima avaliação">→</button></div>}
      </div> : <div className="reviews-empty"><Stars rating={5} /><strong>Sua empresa pode ser a primeira a avaliar o GrupoTrevisan.</strong><span>Compartilhe sua experiência pelo formulário abaixo.</span></div>}
      {sent && <p className="reviews-success" role="status">Obrigado! Sua avaliação foi enviada e aparecerá aqui após aprovação.</p>}
      {error && <p className="reviews-error" role="alert">{error}</p>}
      {formOpen && <form className="review-form" ref={formRef} onSubmit={submit}>
        <div className="review-form-top"><div><h3>Deixe sua avaliação</h3><p>Conte como foi a experiência da sua empresa com o GrupoTrevisan.</p></div><button type="button" className="review-form-close" onClick={() => setFormOpen(false)} aria-label="Fechar formulário">×</button></div>
        <div className="review-form-grid">
          <label>Seu nome *<input required minLength={2} maxLength={80} value={form.authorName} onChange={(event) => setForm({ ...form, authorName: event.target.value })} /></label>
          <label>Empresa *<input required minLength={2} maxLength={100} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label>
          <label>Cargo (opcional)<input maxLength={80} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></label>
          <fieldset className="review-rating"><legend>Sua nota *</legend>{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={value <= form.rating ? 'selected' : ''} onClick={() => setForm({ ...form, rating: value })} aria-label={`${value} ${value === 1 ? 'estrela' : 'estrelas'}`} aria-pressed={form.rating === value}>★</button>)}</fieldset>
          <label className="review-message">Sua avaliação *<textarea required minLength={20} maxLength={1000} rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Conte o que sua empresa achou das nossas soluções e do atendimento." /><small>Mínimo de 20 caracteres.</small></label>
          <label className="review-honeypot" aria-hidden="true">Site<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label>
        </div>
        <label className="review-consent"><input type="checkbox" required checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /> Autorizo a publicação do meu nome, empresa, cargo e avaliação após análise da equipe.</label>
        <button className="btn" type="submit" disabled={sending}>{sending ? 'Enviando...' : 'Enviar avaliação'}</button>
      </form>}
    </div>
  </section>;
}
