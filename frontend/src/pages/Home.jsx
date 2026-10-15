import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { api } from '../api.js';
import ChatWidget from '../components/ChatWidget.jsx';

const SEG_IMG = {
  Logistica: '/img/logistica.jpg',
  Educacao: '/img/educacao.jpg',
  Saude: '/img/saude.jpg',
  Varejo: '/img/varejo.jpg',
  Industria: '/img/industria.jpg',
  Governo: '/img/governo.jpg',
};

export default function Home() {
  const { settings, products, solutions, segments } = useApp();
  const s = settings || {};
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sent, setSent] = useState(false);
  const [catalogHighlights, setCatalogHighlights] = useState([]);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    company: '',
    cnpj: '',
    phone: '',
    email: '',
    pillar: '',
    message: '',
    consent: false,
  });

  useEffect(() => {
    document.title = `${s.brandName || 'GrupoTrevisan'} | ${s.tagline || 'Outsourcing de Equipamentos de TI'}`;
  }, [s]);

  useEffect(() => {
    api('/api/catalog-products').then((items) => setCatalogHighlights(items.filter((item) => item.active !== false).slice(0, 4))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!s || s.chatEnabled === false || s.chatAutoOpen === false) return;
    const delay = Math.max(1, Number(s.chatOpenDelay) || 10) * 1000;
    const t = setTimeout(() => setOpen(true), delay);
    return () => clearTimeout(t);
  }, [s.chatEnabled, s.chatAutoOpen, s.chatOpenDelay]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    await api('/api/leads', { method: 'POST', body: JSON.stringify(form) });
    setSent(true);
  };

  const heroUrl = s.heroImage || '/img/hero.jpg';
  const heroStyle = {
    backgroundImage: `linear-gradient(90deg, rgba(6,8,40,.92) 0%, rgba(10,20,70,.55) 42%, rgba(20,30,90,.15) 70%), url(${heroUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center right',
  };

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-inner">
          <a href="#contato">Fale conosco</a>
          <a href={`tel:${(s.phone || '(11) 99510-6569').replace(/\D/g, '')}`}>{s.phone || '(11) 99510-6569'}</a>
          <div className="socials">
            <a href="#" aria-label="LinkedIn">in</a>
            <a href="#" aria-label="Instagram">ig</a>
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="YouTube">yt</a>
          </div>
        </div>
      </div>

      <header className="header">
        <div className="container nav">
          <a className="logo" href="/">
            {s.logo ? <img src={s.logo} alt={s.brandName} /> : (
              <>
                <span className="logo-mark" />
                {s.brandName || 'GrupoTrevisan'}
              </>
            )}
          </a>
          <button className="burger" onClick={() => setMenu((v) => !v)} aria-label="Menu">=</button>
          <ul className={`menu ${menu ? 'open' : ''}`}>
            <li>
              <button type="button">Solucoes</button>
              <div className="dropdown">
                {(solutions || []).map((x) => (
                  <a key={x.id} href="#solucoes">{x.subtitle} - {x.title}</a>
                ))}
              </div>
            </li>
            <li>
              <Link to="/equipamentos">Equipamentos</Link>
              <div className="dropdown">
                <Link to="/equipamentos?categoria=impressoras">Impressoras</Link>
                <Link to="/equipamentos?categoria=multifuncionais">Multifuncionais</Link>
                <Link to="/equipamentos?categoria=scanners">Scanners</Link>
                <Link to="/equipamentos?categoria=largo-formato">Largo Formato</Link>
              </div>
            </li>
            <li>
              <button type="button">Para sua empresa</button>
              <div className="dropdown">
                {(segments || []).map((x) => (
                  <a key={x.id} href="#segmentos">{x.title}</a>
                ))}
              </div>
            </li>
            <li>
              <button type="button">Institucional</button>
              <div className="dropdown">
                <a href="#contato">Quem somos</a>
                <a href="#contato">Trabalhe conosco</a>
                <a href="#contato">ESG</a>
              </div>
            </li>
            <li><a href="#contato">Contato</a></li>
            <li><Link to="/login" className="btn-client">Ja sou cliente</Link></li>
          </ul>
        </div>
      </header>

      <section className="hero" style={heroStyle}>
        <div className="container hero-content">
          <h1>{s.heroTitle || 'Há 10 anos, líder em outsourcing de equipamentos de TI'}</h1>
          <p>{s.heroSubtitle}</p>
          <a className="btn-cta" href="#contato">
            {s.heroCta || 'Conte com nossas solucoes'}
            <span>→</span>
          </a>
        </div>
      </section>

      <div className="container">
        <div className="solutions" id="solucoes">
          {(solutions || []).map((x) => (
            <a key={x.id} className="sol-card" href="#produtos" style={{ background: x.color }}>
              <div className="kicker">{x.subtitle}</div>
              <h3>{x.title}</h3>
              <p>{x.description}</p>
              <div className="more">Saiba mais →</div>
            </a>
          ))}
        </div>
      </div>

      <section className="section" id="segmentos">
        <div className="container">
          <p className="lead">Solucoes completas para sua empresa, seja qual for a area de atuacao</p>
          <h2>Segmentos</h2>
          <div className="segments">
            {(segments || []).map((x) => (
              <article key={x.id} className="seg-card">
                <div className="seg-photo">
                  <img src={x.image || SEG_IMG[x.title]} alt={x.title} />
                </div>
                <h3>{x.title}</h3>
                <p>{x.description}</p>
                <a className="link-more" href="#contato">Saiba mais</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="produtos" style={{ background: '#f7f9ff' }}>
        <div className="container">
          <h2>Equipamentos em destaque</h2>
          <p className="lead">Equipamentos prontos para a operacao da sua empresa, com suporte e gestao incluidos.</p>
          <div className="products">
            {(catalogHighlights.length ? catalogHighlights : (products || []).filter((p) => p.featured !== false)).map((p) => (
              <article key={p.id} className="prod-card">
                <div className={`prod-img ${catalogHighlights.length ? 'catalog-highlight' : ''}`}>
                  {p.image ? <img src={p.image} alt={p.name} /> : p.category}
                </div>
                <div className="prod-body">
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <div className="prod-meta">{typeof p.price === 'number' ? p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : p.price || 'Sob consulta'}</div>
                  <Link className="link-more" to={catalogHighlights.length ? `/equipamentos/${encodeURIComponent(p.id)}` : '/equipamentos'}>Ver equipamento →</Link>
                </div>
              </article>
            ))}
          </div>
          <Link className="btn-cta" to="/equipamentos" style={{ marginTop: 28 }}>Ver catálogo completo <span>→</span></Link>
        </div>
      </section>

      <section className="section awards">
        <div className="container">
          <h2>Reconhecimento</h2>
          <div className="seals">
            {['Valor 1000', 'Exame Melhores', 'GHG Protocol', 'Ranking TI', 'Qualidade', 'Inovacao'].map((n) => (
              <div className="seal" key={n}>{n}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="contato">
        <div className="container contact-wrap">
          <div>
            <h2>Conheca nossas solucoes e fale com nossos especialistas</h2>
            <p className="lead">
              Queremos te ajudar a solucionar os desafios na gestao de equipamentos de TI e tornar o seu dia a dia ainda mais simples. Vamos conversar?
            </p>
            <img src="/img/meeting.jpg" alt="Reuniao" className="contact-side" />
          </div>
          <form className="box-form" onSubmit={submit}>
            <div className="form-grid">
              <div className="field"><label>Seu nome *</label><input name="firstName" required value={form.firstName} onChange={onChange} /></div>
              <div className="field"><label>Sobrenome *</label><input name="lastName" required value={form.lastName} onChange={onChange} /></div>
              <div className="field"><label>Empresa *</label><input name="company" required value={form.company} onChange={onChange} /></div>
              <div className="field"><label>CNPJ *</label><input name="cnpj" required value={form.cnpj} onChange={onChange} /></div>
              <div className="field"><label>Telefone *</label><input name="phone" required value={form.phone} onChange={onChange} /></div>
              <div className="field"><label>E-mail corporativo *</label><input type="email" name="email" required value={form.email} onChange={onChange} /></div>
              <div className="field full">
                <label>Sobre qual pilar deseja falar? *</label>
                <select name="pillar" required value={form.pillar} onChange={onChange}>
                  <option value="">Selecione</option>
                  <option>Impressoras e Multifuncionais</option>
                  <option>Notebooks e Desktops</option>
                  <option>Smartphones e Tablets</option>
                  <option>Impressoras Termicas e Coletores</option>
                  <option>Videoconferencia</option>
                </select>
              </div>
              <div className="field full">
                <label>Como podemos ajudar</label>
                <textarea name="message" value={form.message} onChange={onChange} />
              </div>
            </div>
            <label className="check">
              <input type="checkbox" name="consent" checked={form.consent} onChange={onChange} />
              Concordo em receber conteudo educacional e promocional relacionado aos produtos e servicos.
            </label>
            <button className="btn-cta" type="submit">Enviar <span>→</span></button>
            {sent && <div className="ok">Recebemos seu contato. Um especialista vai retornar em breve.</div>}
          </form>
        </div>
      </section>

      <footer className="footer">
        <div className="container foot-grid">
          <div>
            {(s.footerLogo || s.logo) ? <Link to="/" className="footer-brand"><img src={s.footerLogo || s.logo} alt={s.brandName || 'GrupoTrevisan'} /></Link> : <h4>{s.brandName || 'GrupoTrevisan'}</h4>}
            <p>{s.tagline}</p>
            <p style={{ marginTop: 12 }}>{s.address}</p>
            <p>{s.phone}</p>
            {s.email && <p>{s.email}</p>}
          </div>
          <div>
            <h4>Institucional</h4>
            <ul>
              <li><a href="#contato">Quem somos</a></li>
              <li><a href="#contato">Politica de privacidade</a></li>
              <li><a href="#contato">Trabalhe conosco</a></li>
            </ul>
          </div>
          <div>
            <h4>Solucoes</h4>
            <ul>
              {(solutions || []).map((x) => <li key={x.id}><a href="#solucoes">{x.title}</a></li>)}
            </ul>
          </div>
          <div>
            <h4>Atendimento</h4>
            <ul>
              <li><a href="#contato">Solicite um orcamento</a></li>
              <li><Link to="/login">Area do vendedor</Link></li>
              <li><Link to="/login">Admin</Link></li>
            </ul>
          </div>
        </div>
        <div className="container copy">© {new Date().getFullYear()} {s.footerText || 'GrupoTrevisan. Todos os Direitos Reservados.'}</div>
      </footer>

      <a
        className="float-wa"
        href={`https://wa.me/${s.whatsapp || '5511995106569'}`}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp"
      >
        <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M16 .8A15.1 15.1 0 0 0 3 23.6L.9 31l7.6-2A15.2 15.2 0 1 0 16 .8Zm0 27.6a12.4 12.4 0 0 1-6.3-1.7l-.5-.3-4.5 1.2 1.2-4.4-.3-.5A12.4 12.4 0 1 1 16 28.4Zm6.8-9.3c-.4-.2-2.2-1.1-2.6-1.2-.3-.1-.6-.2-.8.2-.3.4-1 1.2-1.2 1.4-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8l.6-.7.4-.6c.1-.2 0-.5 0-.7l-1.2-2.8c-.3-.7-.6-.6-.8-.6h-.7c-.3 0-.7.1-1 .5s-1.3 1.3-1.3 3.1 1.4 1.8c.2 2.3 3.2 4.9 4.1.7.6 1.3 1.1 2 1.5.8.4 1.5.6 2 .8.8.2 1.5.2 2.1.1.6-.1 2.2-.9 2.5-1.8.3-.9.3-1.7.2-1.8-.1-.2-.3-.3-.7-.5Z" />
        </svg>
      </a>
      {s.chatEnabled !== false && !open && (
        <button className="float-chat" type="button" onClick={() => setOpen(true)} aria-label="Abrir chat ao vivo" title="Chat ao vivo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.4-.7L3 21l1.7-5.2A8.5 8.5 0 1 1 20.5 11.5Z" />
            <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth="2.6" />
          </svg>
        </button>
      )}
      {open && <ChatWidget onClose={() => setOpen(false)} settings={s} />}
    </div>
  );
}
