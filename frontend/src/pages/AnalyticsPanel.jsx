import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

function dateValue(date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

export default function AnalyticsPanel() {
  const [period, setPeriod] = useState('day');
  const [fromDate, setFromDate] = useState(dateValue(Date.now() - 29 * 86400000));
  const [toDate, setToDate] = useState(dateValue(Date.now()));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const range = useMemo(() => {
    const now = new Date(nowTick);
    if (period === 'day') return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), to: nowTick };
    if (period === 'week') return { from: nowTick - 7 * 86400000, to: nowTick };
    return { from: new Date(`${fromDate}T00:00:00`).getTime(), to: new Date(`${toDate}T23:59:59`).getTime() };
  }, [period, fromDate, toDate, nowTick]);

  useEffect(() => {
    if (!Number.isFinite(range.from) || !Number.isFinite(range.to) || range.from > range.to) { setError('Escolha um período válido.'); return; }
    let alive = true;
    api(`/api/analytics?from=${range.from}&to=${range.to}`)
      .then((result) => { if (alive) { setData(result); setError(''); } })
      .catch((cause) => { if (alive) setError(cause.message); });
    return () => { alive = false; };
  }, [range]);

  const maxDay = Math.max(1, ...(data?.days || []).map((day) => day.count));
  return <div className="panel analytics-panel">
    <div className="analytics-heading"><div><h3>Acessos e interesse no site</h3><p className="admin-help">Visitas e cliques registrados a partir da publicação deste painel.</p></div><div className="analytics-period"><button type="button" className={period === 'day' ? 'on' : ''} onClick={() => setPeriod('day')}>Hoje</button><button type="button" className={period === 'week' ? 'on' : ''} onClick={() => setPeriod('week')}>7 dias</button><button type="button" className={period === 'custom' ? 'on' : ''} onClick={() => setPeriod('custom')}>Período</button></div></div>
    {period === 'custom' && <div className="analytics-dates"><label>De <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>Até <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label></div>}
    {error && <p className="err" role="alert">{error}</p>}
    <div className="analytics-stats"><div><span>Visualizações</span><strong>{data?.pageviews ?? '—'}</strong></div><div><span>Visitantes únicos</span><strong>{data?.visitors ?? '—'}</strong></div><div><span>Sessões</span><strong>{data?.sessions ?? '—'}</strong></div><div><span>Cliques</span><strong>{data?.clicks ?? '—'}</strong></div></div>
    <div className="analytics-sections"><section><h4>Visitas por dia</h4>{data?.days?.length ? <div className="analytics-bars">{data.days.map((day) => <div key={day.name}><span>{day.name.slice(5)}</span><div><i style={{ width: `${Math.max(4, day.count / maxDay * 100)}%` }} /></div><strong>{day.count}</strong></div>)}</div> : <p className="admin-help">Ainda não há visitas registradas neste período.</p>}</section><section><h4>Páginas mais acessadas</h4>{data?.pages?.length ? <ol className="analytics-ranking">{data.pages.map((page) => <li key={page.name}><span>{page.name}</span><strong>{page.count}</strong></li>)}</ol> : <p className="admin-help">Ainda não há páginas registradas.</p>}</section><section className="analytics-wide"><h4>Itens mais clicados</h4>{data?.items?.length ? <ol className="analytics-ranking">{data.items.map((item) => <li key={item.name}><span>{item.name}</span><strong>{item.count}</strong></li>)}</ol> : <p className="admin-help">Ainda não há cliques registrados.</p>}</section></div>
  </div>;
}
