import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const labels = { pending: 'Pendente', approved: 'Publicada', rejected: 'Rejeitada' };

export default function ReviewsAdmin() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    try { setItems(await api('/api/reviews/moderation')); setError(''); }
    catch (cause) { setError(cause.message); }
  };

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const update = async (item, status) => {
    setBusyId(item.id);
    setError('');
    try {
      const updated = await api(`/api/reviews/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
    } catch (cause) { setError(cause.message); }
    finally { setBusyId(''); }
  };

  const visible = useMemo(() => items.filter((item) => filter === 'all' || item.status === filter), [items, filter]);
  const counts = { pending: items.filter((item) => item.status === 'pending').length, approved: items.filter((item) => item.status === 'approved').length, rejected: items.filter((item) => item.status === 'rejected').length };

  return <div className="panel reviews-admin">
    <div className="reviews-admin-head"><div><h3>Aprovações de avaliações</h3><p>Leia cada avaliação antes de publicá-la no site. Envios pendentes não aparecem para os visitantes.</p></div><button type="button" className="btn ghost" onClick={refresh}>Atualizar</button></div>
    <div className="reviews-admin-filters" role="group" aria-label="Filtrar avaliações">{[['pending', `Pendentes (${counts.pending})`], ['approved', `Publicadas (${counts.approved})`], ['rejected', `Rejeitadas (${counts.rejected})`], ['all', 'Todas']].map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} type="button" onClick={() => setFilter(value)}>{label}</button>)}</div>
    {error && <p className="reviews-error" role="alert">{error}</p>}
    {visible.length ? <div className="reviews-admin-list">{visible.map((item) => <article className="review-moderation-card" key={item.id}>
      <div className="review-moderation-top"><div><span className={'review-moderation-status ' + item.status}>{labels[item.status] || item.status}</span><h4>{item.company}</h4><p>{item.authorName}{item.role ? ` · ${item.role}` : ''}</p></div><div className="review-stars" aria-label={`${item.rating} de 5 estrelas`}>{[1, 2, 3, 4, 5].map((value) => <span className={value <= item.rating ? 'filled' : ''} key={value} aria-hidden="true">★</span>)}</div></div>
      <blockquote>“{item.message}”</blockquote><small>Enviada em {new Date(item.createdAt).toLocaleString('pt-BR')}</small>
      <div className="review-moderation-actions">{item.status !== 'approved' && <button type="button" className="btn" disabled={busyId === item.id} onClick={() => update(item, 'approved')}>Aprovar e publicar</button>}{item.status !== 'rejected' && <button type="button" className="btn ghost" disabled={busyId === item.id} onClick={() => update(item, 'rejected')}>Rejeitar</button>}{item.status !== 'pending' && <button type="button" className="review-return-pending" disabled={busyId === item.id} onClick={() => update(item, 'pending')}>Voltar para pendentes</button>}</div>
    </article>)}</div> : <p className="reviews-admin-empty">Nenhuma avaliação neste filtro.</p>}
  </div>;
}
