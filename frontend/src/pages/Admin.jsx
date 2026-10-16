import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { api } from '../api.js';
import CatalogAdmin from './CatalogAdmin.jsx';
import AnalyticsPanel from './AnalyticsPanel.jsx';
import Seller from './Seller.jsx';

function Uploader({ type, onDone, label, accept }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type || 'file');
    try {
      const item = await api('/api/upload', { method: 'POST', body: fd });
      onDone(item);
      e.target.value = '';
    } catch (error) { window.alert(error.message); }
    finally { setBusy(false); }
  };
  return (
    <label className="drop">
      {busy ? 'Enviando...' : label || 'Clique para enviar arquivo ou foto'}
      <input type="file" hidden accept={accept} onChange={pick} />
    </label>
  );
}

function ThemeColorField({ label, value, fallback, onChange }) {
  return (
    <div className="theme-color-field">
      <label>{label}</label>
      <div className="theme-color-control">
        <input type="color" aria-label={`Cor de ${label.toLowerCase()}`} value={value || fallback} onChange={(e) => onChange(e.target.value)} />
        <span>{value || 'Cor padrão'}</span>
        {value && <button type="button" className="theme-color-reset" onClick={() => onChange('')}>Restaurar padrão</button>}
      </div>
    </div>
  );
}

export default function Admin() {
  const { settings, logout, refresh, user } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    return ['marca', 'seo', 'chat', 'leads', 'analytics', 'midia', 'produtos', 'equipe', 'acesso'].includes(requested) ? requested : 'marca';
  });
  const [form, setForm] = useState(settings || {});
  const [files, setFiles] = useState([]);
  const [users, setUsers] = useState([]);
  const [seller, setSeller] = useState({ name: '', email: '', password: '', role: 'seller' });
  const [credentials, setCredentials] = useState({ email: user?.email || '', password: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  useEffect(() => {
    api('/api/files').then(setFiles).catch(() => {});
    api('/api/users').then(setUsers).catch(() => {});
  }, [tab]);

  const saveBrand = async (e) => {
    e.preventDefault();
    if (tab === 'chat' && (form.chatFlow || []).some((step) => step.kind === 'audio' && !step.audioUrl)) {
      window.alert('Envie um arquivo para cada etapa de áudio antes de salvar.');
      return;
    }
    try {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify(form) });
      await refresh();
      setMsg('Configurações atualizadas');
    } catch (error) { window.alert(error.message); }
  };

  const addUser = async (e) => {
    e.preventDefault();
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify(seller) });
      setUsers(await api('/api/users'));
      setSeller({ name: '', email: '', password: '', role: 'seller' });
      setMsg('Usuario criado');
    } catch (error) { setMsg(error.message); }
  };

  const saveCredentials = async (e) => {
    e.preventDefault();
    try {
      await api('/api/auth/admin-credentials', { method: 'POST', body: JSON.stringify(credentials) });
      logout();
      nav('/login');
    } catch (error) { setMsg(error.message); }
  };

  return (
    <div className="dash">
      <aside className="side">
        <div className="logo" style={{ marginBottom: 18 }}>
          <span className="logo-mark" />
          Admin
        </div>
        <button type="button" className={`tab-button ${tab === 'leads' ? 'active' : ''}`} onClick={() => setTab('leads')}>Leads e conversas</button>
        <button type="button" className={`tab-button ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>Acessos e cliques</button>
        <button type="button" className={`tab-button ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>Fluxo do chat</button>
        <button type="button" className={`tab-button ${tab === 'marca' ? 'active' : ''}`} onClick={() => setTab('marca')}>Marca e logo</button>
        <button type="button" className={`tab-button ${tab === 'seo' ? 'active' : ''}`} onClick={() => setTab('seo')}>SEO e Google</button>
        <button type="button" className={`tab-button ${tab === 'midia' ? 'active' : ''}`} onClick={() => setTab('midia')}>Uploads</button>
        <button type="button" className={`tab-button ${tab === 'produtos' ? 'active' : ''}`} onClick={() => setTab('produtos')}>Produtos e equipamentos</button>
        <button type="button" className={`tab-button ${tab === 'equipe' ? 'active' : ''}`} onClick={() => setTab('equipe')}>Equipe</button>
        <button type="button" className={`tab-button ${tab === 'acesso' ? 'active' : ''}`} onClick={() => setTab('acesso')}>Acesso admin</button>
        <NavLink to="/vendedor">Tela cheia do atendimento</NavLink>
        <NavLink to="/">Ver site</NavLink>
        <button className="link" onClick={() => { logout(); nav('/login'); }}>Sair</button>
        <div style={{ marginTop: 'auto', fontSize: 12, opacity: .7 }}>{user?.email}</div>
      </aside>
      <div className="main">
        <h1>{({ marca: 'Painel da marca', seo: 'SEO e Google', chat: 'Fluxo do chat', leads: 'Leads e conversas', analytics: 'Acessos e cliques', midia: 'Biblioteca de arquivos', produtos: 'Produtos e equipamentos', equipe: 'Equipe', acesso: 'Acesso admin' })[tab]}</h1>
        {msg && <div className="ok" style={{ marginBottom: 12 }}>{msg}</div>}

        {tab === 'acesso' && (
          <form className="panel" onSubmit={saveCredentials}>
            <h3>Acesso do administrador</h3>
            <p>Altere o e-mail e a senha usados para entrar no painel. Você precisará fazer login novamente.</p>
            <div className="field"><label>E-mail</label><input type="email" required value={credentials.email} onChange={(e) => setCredentials({ ...credentials, email: e.target.value })} /></div>
            <div className="field"><label>Nova senha (mínimo 12 caracteres)</label><input type="password" minLength={12} required value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} /></div>
            <button className="btn" type="submit">Salvar acesso</button>
          </form>
        )}

        {tab === 'marca' && (
          <form className="panel" onSubmit={saveBrand}>
            <h3 style={{ marginBottom: 14 }}>Identidade</h3>
            <div className="row">
              <div className="field"><label>Nome da marca</label><input value={form.brandName || ''} onChange={(e) => setForm({ ...form, brandName: e.target.value })} /></div>
              <div className="field"><label>Tagline</label><input value={form.tagline || ''} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
            </div>
            <div className="field" style={{ marginTop: 12 }}><label>Titulo do hero</label><input value={form.heroTitle || ''} onChange={(e) => setForm({ ...form, heroTitle: e.target.value })} /></div>
            <div className="field" style={{ marginTop: 12 }}><label>Subtitulo</label><textarea value={form.heroSubtitle || ''} onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })} /></div>
            <div className="row" style={{ marginTop: 12 }}>
              <div className="field"><label>CTA</label><input value={form.heroCta || ''} onChange={(e) => setForm({ ...form, heroCta: e.target.value })} /></div>
              <div className="field"><label>Telefone</label><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="field"><label>WhatsApp dos pedidos (com DDD)</label><input value={form.whatsapp || ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /><small>Produtos individuais e carrinhos serão enviados para este número.</small></div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <div className="field"><label>E-mail</label><input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="field"><label>Endereco</label><input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="instagram-handle">@ do Instagram</label>
              <input id="instagram-handle" placeholder="@grupotrevisan" pattern="@?[A-Za-z0-9._]{1,30}" title="Digite apenas o @ do perfil, por exemplo @grupotrevisan" value={form.instagramHandle || ''} onChange={(e) => setForm({ ...form, instagramHandle: e.target.value })} />
              <small>O ícone aparece na barra superior após salvar. Deixe vazio para ocultar.</small>
            </div>
            <div className="theme-colors">
              <h4>Cores das barras</h4>
              <p className="admin-help">Escolha uma cor para cada área. O texto se ajusta para continuar legível. Clique em Salvar marca para publicar.</p>
              <div className="theme-color-grid">
                <ThemeColorField label="Barra superior de contato" value={form.toolbarColor} fallback="#ffffff" onChange={(color) => setForm((current) => ({ ...current, toolbarColor: color }))} />
                <ThemeColorField label="Cabeçalho e menu" value={form.headerColor} fallback="#18118d" onChange={(color) => setForm((current) => ({ ...current, headerColor: color }))} />
                <ThemeColorField label="Barra do rodapé" value={form.footerColor} fallback="#0b0a4a" onChange={(color) => setForm((current) => ({ ...current, footerColor: color }))} />
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <label>Logomarca do cabeçalho</label>
              <Uploader type="logo" label="Enviar logomarca" accept="image/*" onDone={(f) => setForm({ ...form, logo: f.url })} />
              {form.logo && <div className="brand-upload-preview"><img src={form.logo} alt="Logomarca do cabeçalho" /><button className="btn ghost" type="button" onClick={() => setForm({ ...form, logo: '' })}>Remover</button></div>}
            </div>
            <div style={{ marginTop: 18 }}>
              <label>Logo do rodapé</label>
              <Uploader type="footer-logo" label="Enviar logo do rodapé" accept="image/*" onDone={(f) => setForm({ ...form, footerLogo: f.url })} />
              {form.footerLogo && <div className="brand-upload-preview"><img src={form.footerLogo} alt="Logo do rodapé" /><button className="btn ghost" type="button" onClick={() => setForm({ ...form, footerLogo: '' })}>Remover</button></div>}
            </div>
            <div style={{ marginTop: 18 }}>
              <label>Ícone do site (favicon)</label>
              <p className="admin-help">Use uma imagem quadrada em PNG, com pelo menos 48 × 48 pixels.</p>
              <Uploader type="favicon" label="Enviar ícone do site" accept="image/png,image/jpeg,image/x-icon,image/vnd.microsoft.icon" onDone={(f) => setForm({ ...form, favicon: f.url })} />
              {form.favicon && <div className="brand-upload-preview"><img src={form.favicon} alt="Ícone do site" /><button className="btn ghost" type="button" onClick={() => setForm({ ...form, favicon: '/favicon.png' })}>Usar ícone padrão</button></div>}
            </div>
            <div style={{ marginTop: 18 }}>
              <label>Imagem do banner</label>
              <Uploader type="hero" label="Enviar foto do hero" onDone={(f) => setForm({ ...form, heroImage: f.url })} />
              {form.heroImage && <img src={form.heroImage} alt="hero" style={{ maxHeight: 140, marginTop: 10, borderRadius: 12 }} />}
            </div>
            <button className="btn" style={{ marginTop: 18 }} type="submit">Salvar marca</button>
          </form>
        )}

        {tab === 'seo' && (
          <form className="panel" onSubmit={saveBrand}>
            <h3 style={{ marginBottom: 8 }}>SEO e compartilhamento</h3>
            <p className="admin-help">Os títulos e descrições aparecem nos metadados das páginas. O Google pode escolher textos diferentes para os resultados.</p>
            <div className="field" style={{ marginTop: 16 }}><label>URL oficial do site</label><input type="url" placeholder="https://www.seudominio.com.br" value={form.siteUrl || ''} onChange={(e) => setForm({ ...form, siteUrl: e.target.value })} /><small>Ativa URLs canônicas e o sitemap. Use o domínio público definitivo.</small></div>
            <div className="field" style={{ marginTop: 16 }}><label>Título da página inicial</label><input value={form.seoHomeTitle || ''} onChange={(e) => setForm({ ...form, seoHomeTitle: e.target.value })} /></div>
            <div className="field" style={{ marginTop: 12 }}><label>Descrição da página inicial</label><textarea value={form.seoHomeDescription || ''} onChange={(e) => setForm({ ...form, seoHomeDescription: e.target.value })} /></div>
            <div className="field" style={{ marginTop: 16 }}><label>Título do catálogo</label><input value={form.seoCatalogTitle || ''} onChange={(e) => setForm({ ...form, seoCatalogTitle: e.target.value })} /></div>
            <div className="field" style={{ marginTop: 12 }}><label>Descrição do catálogo</label><textarea value={form.seoCatalogDescription || ''} onChange={(e) => setForm({ ...form, seoCatalogDescription: e.target.value })} /></div>
            <div style={{ marginTop: 16 }}><label>Imagem para compartilhamento</label><p className="admin-help">Aparece em prévias de links em redes sociais e mensagens.</p><Uploader type="seo-image" label="Enviar imagem de compartilhamento" accept="image/*" onDone={(f) => setForm({ ...form, seoImage: f.url })} />{form.seoImage && <div className="brand-upload-preview"><img src={form.seoImage} alt="Imagem de compartilhamento" /><button className="btn ghost" type="button" onClick={() => setForm({ ...form, seoImage: '' })}>Remover</button></div>}</div>
            <div className="field" style={{ marginTop: 16 }}><label>Token de verificação do Google Search Console</label><input value={form.googleSiteVerification || ''} onChange={(e) => setForm({ ...form, googleSiteVerification: e.target.value })} /><small>Cole somente o valor do atributo content da metatag fornecida pelo Google.</small></div>
            <label className="check" style={{ marginTop: 16 }}><input type="checkbox" checked={form.seoIndexing !== false} onChange={(e) => setForm({ ...form, seoIndexing: e.target.checked })} />Permitir indexação das páginas públicas</label>
            <p className="admin-help">Após informar a URL oficial, o mapa do site ficará em <a href="/sitemap.xml" target="_blank" rel="noreferrer">/sitemap.xml</a> e as regras de rastreamento em <a href="/robots.txt" target="_blank" rel="noreferrer">/robots.txt</a>.</p>
            <button className="btn" type="submit" style={{ marginTop: 18 }}>Salvar SEO</button>
          </form>
        )}

        {tab === 'chat' && (
          <form className="panel" onSubmit={saveBrand}>
            <h3>Chat automatico</h3>
            <p className="lead">O widget abre sozinho no tempo que voce definir e ja inicia a conversa com o fluxo abaixo.</p>
            <div className="row">
              <label className="check" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={form.chatEnabled !== false}
                  onChange={(e) => setForm({ ...form, chatEnabled: e.target.checked })}
                />
                Chat ligado
              </label>
              <label className="check" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={form.chatAutoOpen !== false}
                  onChange={(e) => setForm({ ...form, chatAutoOpen: e.target.checked })}
                />
                Abrir sozinho
              </label>
              <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={form.chatWhatsappOption === true} onChange={(e) => setForm({ ...form, chatWhatsappOption: e.target.checked })} />Mostrar opção de continuar no WhatsApp</label>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <div className="field">
                <label>Abrir apos (segundos)</label>
                <input
                  type="number"
                  min="1"
                  value={form.chatOpenDelay ?? 10}
                  onChange={(e) => setForm({ ...form, chatOpenDelay: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Nome do atendente</label>
                <input value={form.chatAgentName || ''} onChange={(e) => setForm({ ...form, chatAgentName: e.target.value })} />
              </div>
              <div className="field">
                <label>Cargo</label>
                <input value={form.chatAgentRole || ''} onChange={(e) => setForm({ ...form, chatAgentRole: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label>Foto do atendente</label>
              <Uploader type="agent" label="Enviar foto" onDone={(f) => setForm({ ...form, chatAgentPhoto: f.url })} />
              {form.chatAgentPhoto && <img src={form.chatAgentPhoto} alt="" style={{ height: 56, width: 56, borderRadius: '50%', objectFit: 'cover', marginTop: 8 }} />}
            </div>
            <h3 style={{ margin: '22px 0 10px' }}>Fluxo da conversa</h3>
            <p className="lead">Use {'{name}'} para o nome do visitante. Adicione textos ou áudios gravados; o tempo definido mostra “Digitando” ou “Gravando áudio” antes de enviar. Aguardar: nada, nome, telefone, e-mail ou qualquer resposta.</p>
            {(form.chatFlow || []).map((step, i) => (
              <div key={step.id || i} className="chat-flow-step"><div className="flow-row">
                <span className="flow-n">{i + 1}</span>
                <select aria-label={`Tipo da etapa ${i + 1}`} value={step.kind || 'text'} onChange={(e) => {
                  const next = [...form.chatFlow]; next[i] = { ...next[i], kind: e.target.value }; setForm({ ...form, chatFlow: next });
                }}><option value="text">Texto</option><option value="audio">Áudio</option></select>
                <input
                  value={step.text}
                  onChange={(e) => {
                    const next = [...form.chatFlow];
                    next[i] = { ...next[i], text: e.target.value };
                    setForm({ ...form, chatFlow: next });
                  }}
                  placeholder={step.kind === 'audio' ? 'Legenda do áudio (opcional)' : 'Mensagem'}
                />
                <select
                  value={step.waitFor || 'none'}
                  onChange={(e) => {
                    const next = [...form.chatFlow];
                    next[i] = { ...next[i], waitFor: e.target.value };
                    setForm({ ...form, chatFlow: next });
                  }}
                >
                  <option value="none">Nao espera</option>
                  <option value="name">Espera o nome</option>
                  <option value="phone">Espera telefone</option>
                  <option value="email">Espera e-mail</option>
                  <option value="any">Espera qualquer resposta</option>
                </select>
                <input
                  type="number"
                  min="300"
                  style={{ width: 90 }}
                  value={step.typingMs || 1200}
                  onChange={(e) => {
                    const next = [...form.chatFlow];
                    next[i] = { ...next[i], typingMs: Number(e.target.value) };
                    setForm({ ...form, chatFlow: next });
                  }}
                  title={step.kind === 'audio' ? 'Tempo gravando áudio (ms)' : 'Tempo digitando (ms)'}
                />
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setForm({ ...form, chatFlow: (form.chatFlow || []).filter((_, j) => j !== i) })}
                >
                  x
                </button>
              </div>{step.kind === 'audio' && <div className="chat-flow-audio"><Uploader type="chat-audio" label={step.audioUrl ? 'Trocar áudio gravado' : 'Enviar áudio gravado'} accept="audio/mpeg,audio/mp4,audio/ogg,audio/webm,audio/wav,.mp3,.m4a,.ogg,.webm,.wav" onDone={(file) => setForm((current) => ({ ...current, chatFlow: current.chatFlow.map((item, index) => index === i ? { ...item, audioUrl: file.url } : item) }))} />{step.audioUrl && <><audio controls preload="none" src={step.audioUrl} /><button className="btn ghost" type="button" onClick={() => setForm((current) => ({ ...current, chatFlow: current.chatFlow.map((item, index) => index === i ? { ...item, audioUrl: '' } : item) }))}>Remover áudio</button></>}</div>}</div>
            ))}
            <button
              type="button"
              className="btn ghost"
              style={{ marginTop: 10 }}
              onClick={() => setForm({
                ...form,
                chatFlow: [...(form.chatFlow || []), { id: `f${Date.now()}`, kind: 'text', text: '', waitFor: 'any', typingMs: 1200 }],
              })}
            >
              + Mensagem
            </button>
            <div>
              <button className="btn" style={{ marginTop: 18 }} type="submit">Salvar fluxo</button>
            </div>
          </form>
        )}

        {tab === 'analytics' && <AnalyticsPanel />}

        {tab === 'leads' && <Seller embedded />}

        {tab === 'midia' && (
          <div className="panel">
            <h3>Biblioteca de arquivos e fotos</h3>
            <p className="lead">Upload direto. Depois copie a URL para produtos ou banner.</p>
            <Uploader type="media" onDone={async () => setFiles(await api('/api/files'))} />
            <div className="thumbs">
              {files.map((f) => (
                <div className="thumb" key={f.id}>
                  {f.mimetype?.startsWith('image/') ? <img src={f.url} alt="" /> : <div style={{ height: 90, display: 'grid', placeItems: 'center' }}>ARQ</div>}
                  <div>{f.originalName}<br />{f.url}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'produtos' && <CatalogAdmin />}

        {tab === 'equipe' && (
          <>
            <form className="panel" onSubmit={addUser}>
              <h3>Novo vendedor</h3>
              <div className="row">
                <div className="field"><label>Nome</label><input required value={seller.name} onChange={(e) => setSeller({ ...seller, name: e.target.value })} /></div>
                <div className="field"><label>E-mail</label><input required value={seller.email} onChange={(e) => setSeller({ ...seller, email: e.target.value })} /></div>
                <div className="field"><label>Senha (minimo 12 caracteres)</label><input type="password" minLength={12} required value={seller.password} onChange={(e) => setSeller({ ...seller, password: e.target.value })} /></div>
              </div>
              <button className="btn" style={{ marginTop: 14 }} type="submit">Criar acesso</button>
            </form>
            <div className="panel">
              <table className="table">
                <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
