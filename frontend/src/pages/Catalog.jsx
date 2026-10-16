import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { api } from '../api.js';
import './catalog.css';

const categories = [
  { slug: 'impressoras', name: 'Impressoras' },
  { slug: 'multifuncionais', name: 'Multifuncionais' },
  { slug: 'scanners', name: 'Scanners' },
  { slug: 'largo-formato', name: 'Largo Formato' },
];

const emptyFilters = { type: [], format: [], volume: '' };
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const imageFor = (product) => product.image || 'https://placehold.co/400x400/eef2fb/1f2a44?text=Sem+imagem';

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem('grupotrevisan_cart') || '[]');
    return Array.isArray(saved) ? saved.filter((item) => item && Number(item.qty) > 0) : [];
  } catch {
    return [];
  }
}

export default function Catalog() {
  const { settings } = useApp();
  const navigate = useNavigate();
  const { productId } = useParams();
  const brand = settings?.brandName || 'GrupoTrevisan';
  const brandLogo = settings?.logo || '';
  const footerLogo = settings?.footerLogo || brandLogo;
  const phone = settings?.phone || '(11) 99510-6569';
  const whatsappNumber = String(settings?.whatsapp || '').replace(/\D/g, '');
  const [params] = useSearchParams();
  const category = params.get('categoria') || '';
  const [filters, setFilters] = useState(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [cart, setCart] = useState(readCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [directProduct, setDirectProduct] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [customer, setCustomer] = useState({ name: '', phone: '', note: '' });
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const activeFilterCount = Number(Boolean(category)) + filters.type.length + filters.format.length + Number(Boolean(filters.volume));

  useEffect(() => {
    if (!productId) setSelected(null);
    else setSelected(catalogProducts.find((product) => String(product.id) === productId && product.active !== false) || null);
  }, [productId, catalogProducts]);
  useEffect(() => {
    api('/api/catalog-products').then((items) => {
      setCatalogProducts(items);
      setCart((current) => current.flatMap((item) => {
        const product = items.find((entry) => entry.id === item.id && entry.active !== false);
        return product ? [{ id: product.id, name: product.name, image: product.image, price: product.price, qty: item.qty }] : [];
      }));
    }).catch(() => setLoadError(true));
  }, []);
  useEffect(() => { localStorage.setItem('grupotrevisan_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    const close = (event) => {
      if (event.key === 'Escape') {
        setCartOpen(false);
        setSelected(null);
        setCheckoutOpen(false);
        setDirectProduct(null);
        if (productId) navigate('/equipamentos');
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [navigate, productId]);

  const setCategory = (slug) => navigate(slug ? `/equipamentos?categoria=${encodeURIComponent(slug)}` : '/equipamentos');
  const closeProduct = () => navigate('/equipamentos');
  const toggleFilter = (key, value) => setFilters((current) => ({
    ...current,
    [key]: current[key].includes(value)
      ? current[key].filter((item) => item !== value)
      : [...current[key], value],
  }));
  const clearFilters = () => {
    setCategory('');
    setFilters(emptyFilters);
    setSearch('');
    setSort('recent');
  };

  const products = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    const list = catalogProducts.filter((product) => {
      const attributes = product.attributes || {};
      return product.active !== false
        && (!category || product.category === category)
        && (!term || [product.name, product.brand, product.description].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term)))
        && (!filters.type.length || filters.type.includes(attributes.tipo_impressao))
        && (!filters.format.length || filters.format.includes(attributes.formato))
        && (!filters.volume || Number(attributes.volume_pagina) >= Number(filters.volume));
    });
    if (sort === 'price_asc') list.sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') list.sort((a, b) => b.price - a.price);
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (sort === 'recent') list.sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
    return list;
  }, [catalogProducts, category, filters, search, sort]);

  const count = cart.reduce((total, item) => total + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const checkoutItems = directProduct ? [{ ...directProduct, qty: 1 }] : cart;
  const checkoutTotal = checkoutItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const closeCheckout = () => { setCheckoutOpen(false); setDirectProduct(null); setCheckoutError(''); };
  const orderProduct = (product) => {
    setDirectProduct(product);
    setCheckoutError('');
    setSelected(null);
    if (productId) navigate('/equipamentos');
    setCartOpen(false);
    setCheckoutOpen(true);
  };
  const addToCart = (product) => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found
        ? current.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
        : [...current, { id: product.id, name: product.name, image: imageFor(product), price: product.price, qty: 1 }];
    });
    setSelected(null);
    if (productId) navigate('/equipamentos');
    setCartOpen(true);
  };
  const changeQty = (id, delta) => setCart((current) => current
    .map((item) => item.id === id ? { ...item, qty: item.qty + delta } : item)
    .filter((item) => item.qty > 0));
  const checkout = (event) => {
    event.preventDefault();
    if (!checkoutItems.length) return;
    const phone = String(settings?.whatsapp || '').replace(/\D/g, '');
    if (phone.length < 12 || phone === '5511999999999') {
      setCheckoutError('Configure o número de WhatsApp no painel administrativo antes de receber pedidos.');
      return;
    }
    const lines = checkoutItems.map((item) => `- ${item.qty}x ${item.name} — ${money(item.price * item.qty)}`);
    const message = [
      `*Novo pedido - ${brand}*`, '',
      `Cliente: ${customer.name}`,
      customer.phone && `Telefone: ${customer.phone}`,
      customer.note && `Observações: ${customer.note}`,
      '', '*Itens:*', ...lines, '', `*Total: ${money(checkoutTotal)}*`,
    ].filter(Boolean).join('\n');
    const opened = window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    if (opened) {
      opened.opener = null;
      if (!directProduct) setCart([]);
      setCartOpen(false);
      closeCheckout();
      setCustomer({ name: '', phone: '', note: '' });
    } else setCheckoutError('O navegador bloqueou a abertura do WhatsApp. Permita pop-ups e tente novamente.');
  };

  return (
    <div className="catalog-page">
      <div className="catalog-topline"><div className="container catalog-topline-inner"><span>Soluções em tecnologia para empresas</span><a href={`tel:${phone.replace(/\D/g, '')}`}>{phone}</a></div></div>
      <header className="catalog-header">
        <div className="container catalog-header-inner">
          <Link className="catalog-brand" to="/" aria-label={`${brand} — página inicial`}>
            {brandLogo ? <img src={brandLogo} alt={brand} /> : <><span className="catalog-brand-mark">GT</span><span>{brand}</span></>}
          </Link>
          <div className="catalog-header-actions">
            <Link className="catalog-nav-home" to="/">Página inicial</Link>
            <span className="catalog-nav-current" aria-current="page">Equipamentos</span>
            <Link className="catalog-nav-admin" to="/admin?tab=produtos">Área administrativa</Link>
            <button className="catalog-cart-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Abrir carrinho com ${count} itens`}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
              <span className="catalog-cart-count">{count}</span>
            </button>
          </div>
        </div>
      </header>

      <section className="catalog-hero">
        <div className="container catalog-hero-inner">
          <div className="catalog-hero-copy">
            <span className="catalog-eyebrow"><span /> CATÁLOGO GRUPOTREVISAN</span>
            <h1>{selected?.name || <>Equipamentos para <em>levar sua empresa mais longe.</em></>}</h1>
            <p>{selected?.description || 'Impressoras, multifuncionais e soluções de TI para a sua operação. Escolha os equipamentos e envie seu pedido pelo WhatsApp.'}</p>
            <div className="catalog-hero-tags"><span>Equipamentos corporativos</span><span>Atendimento pelo WhatsApp</span></div>
          </div>
          <div className="catalog-hero-visual" aria-hidden="true">
            <div className="catalog-hero-orbit catalog-hero-orbit-one" />
            <div className="catalog-hero-orbit catalog-hero-orbit-two" />
            <div className="catalog-hero-display"><span className="catalog-display-label">SOLUÇÕES TREVISAN</span><svg viewBox="0 0 160 160" fill="none"><rect x="32" y="22" width="96" height="48" rx="8" stroke="currentColor" strokeWidth="5"/><path d="M34 61h92a20 20 0 0 1 20 20v39H14V81a20 20 0 0 1 20-20Z" stroke="currentColor" strokeWidth="5"/><rect x="36" y="105" width="88" height="40" rx="6" fill="#fff" stroke="currentColor" strokeWidth="5"/><path d="M54 119h52M54 131h36" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><circle cx="122" cy="84" r="5" fill="#21c7f2"/></svg><strong>TreviPrinter</strong><small>Tecnologia que acompanha seu negócio</small></div>
          </div>
        </div>
      </section>

      <main className="container catalog-layout">
        <aside className={`catalog-filters ${filtersOpen ? 'is-open' : ''}`} aria-label="Filtros de produtos">
          <button className="catalog-filters-toggle" type="button" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen} aria-controls="catalog-filters-body">
            <span>Filtros {activeFilterCount > 0 && <span className="catalog-filter-count">{activeFilterCount}</span>}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <div className="catalog-filters-body" id="catalog-filters-body">
          <div className="catalog-filter-block"><h2>Categorias</h2><ul className="catalog-categories">
            <li><button type="button" className={!category ? 'active' : ''} onClick={() => setCategory('')}>Todos <span>{catalogProducts.filter((p) => p.active !== false).length}</span></button></li>
            {categories.map((item) => <li key={item.slug}><button type="button" className={category === item.slug ? 'active' : ''} onClick={() => setCategory(item.slug)}>{item.name}<span>{catalogProducts.filter((p) => p.active !== false && p.category === item.slug).length}</span></button></li>)}
          </ul></div>
          <div className="catalog-filter-block"><h2>Tipo de impressão</h2>
            {['Monocromatico', 'Colorido'].map((value) => <label className="catalog-check" key={value}><input type="checkbox" checked={filters.type.includes(value)} onChange={() => toggleFilter('type', value)} />{value === 'Monocromatico' ? 'Monocromático' : value}</label>)}
          </div>
          <div className="catalog-filter-block"><h2>Formato</h2>
            {['A3', 'A4'].map((value) => <label className="catalog-check" key={value}><input type="checkbox" checked={filters.format.includes(value)} onChange={() => toggleFilter('format', value)} />{value}</label>)}
          </div>
          <div className="catalog-filter-block"><h2>Volume de páginas por mês</h2><select className="catalog-control" value={filters.volume} onChange={(event) => setFilters({ ...filters, volume: event.target.value })}>
            <option value="">Selecione</option>{[15000, 50000, 80000, 100000, 120000, 150000].map((value) => <option key={value} value={value}>{value / 1000} mil folhas</option>)}
          </select></div>
          <button type="button" className="catalog-button catalog-ghost" onClick={clearFilters}>Limpar filtros</button>
          </div>
        </aside>

        <section className="catalog-content" aria-label="Produtos">
          <div className="catalog-toolbar"><input className="catalog-control catalog-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produtos..." aria-label="Buscar produtos" />
            <select className="catalog-control catalog-sort" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar produtos">
              <option value="recent">Mais recentes</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option><option value="name">Nome (A-Z)</option>
            </select>
          </div>
          {loadError ? <div className="catalog-empty">Não foi possível carregar o catálogo. Atualize a página para tentar novamente.</div> : products.length ? <div className="catalog-grid">{products.map((product) => <article className="catalog-card" key={product.id}>
            <Link className="catalog-card-media" to={`/equipamentos/${encodeURIComponent(product.id)}`} aria-label={`Ver detalhes de ${product.name}`} data-track={`Produto: ${product.name}`}><img src={imageFor(product)} alt={product.name} loading="lazy" /></Link>
            <div className="catalog-card-body"><span className="catalog-card-brand">{product.brand}</span><Link className="catalog-card-title" to={`/equipamentos/${encodeURIComponent(product.id)}`} data-track={`Produto: ${product.name}`}>{product.name}</Link>
              <p>{product.description}</p><div className="catalog-card-price"><strong>{money(product.price)}</strong>{product.oldPrice && <del>{money(product.oldPrice)}</del>}</div>
              <div className="catalog-card-actions"><button className="catalog-button catalog-primary" type="button" data-track={`Adicionar ao carrinho: ${product.name}`} onClick={() => addToCart(product)}>Adicionar ao carrinho</button><button className="catalog-button catalog-whatsapp" type="button" data-track={`WhatsApp: ${product.name}`} onClick={() => orderProduct(product)}>Pedir pelo WhatsApp</button></div>
            </div>
          </article>)}</div> : <div className="catalog-empty">Nenhum produto encontrado.</div>}
        </section>
      </main>

      <footer className="catalog-footer"><div className="container catalog-footer-inner"><div className="catalog-footer-brand">{footerLogo ? <Link to="/"><img src={footerLogo} alt={brand} /></Link> : <strong>{brand}</strong>}<p>Outsourcing e equipamentos de TI para empresas.</p></div><div className="catalog-footer-contact"><strong>Fale com a gente</strong><a href={`tel:${phone.replace(/\D/g, '')}`}>{phone}</a>{whatsappNumber && <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">Conversar pelo WhatsApp ↗</a>}</div><div className="catalog-footer-links"><strong>Explore</strong><Link to="/">Página inicial</Link><Link to="/equipamentos">Equipamentos</Link></div></div><div className="container catalog-footer-bottom">© {new Date().getFullYear()} {brand}. Todos os direitos reservados.</div></footer>

      {cartOpen && <><button type="button" className="catalog-overlay" aria-label="Fechar carrinho" onClick={() => setCartOpen(false)} /><aside className="catalog-drawer" aria-label="Seu carrinho">
        <div className="catalog-drawer-head"><h2>Seu carrinho</h2><button className="catalog-icon-button" type="button" onClick={() => setCartOpen(false)} aria-label="Fechar carrinho">×</button></div>
        <div className="catalog-cart-items">{cart.length ? cart.map((item) => <div className="catalog-cart-item" key={item.id}><img src={imageFor(item)} alt="" /><div><h3>{item.name}</h3><strong>{money(item.price)}</strong><div className="catalog-quantity"><button type="button" onClick={() => changeQty(item.id, -1)} aria-label={`Diminuir quantidade de ${item.name}`}>−</button><span>{item.qty}</span><button type="button" onClick={() => changeQty(item.id, 1)} aria-label={`Aumentar quantidade de ${item.name}`}>+</button></div><button className="catalog-remove" type="button" onClick={() => setCart((current) => current.filter((product) => product.id !== item.id))}>Remover</button></div></div>) : <p>Seu carrinho está vazio.</p>}</div>
        <div className="catalog-drawer-foot"><div><span>Total</span><strong>{money(total)}</strong></div><button className="catalog-button catalog-primary" type="button" disabled={!cart.length} onClick={() => { setDirectProduct(null); setCheckoutError(''); setCheckoutOpen(true); }}>Finalizar pelo WhatsApp</button></div>
      </aside></>}

      {selected && <div className="catalog-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeProduct(); }}><div className="catalog-modal" role="dialog" aria-modal="true" aria-label={`Detalhes de ${selected.name}`}><button className="catalog-icon-button catalog-close" type="button" onClick={closeProduct} aria-label="Fechar detalhes">×</button><div className="catalog-detail"><div className="catalog-detail-media"><img src={imageFor(selected)} alt={selected.name} /></div><div><span className="catalog-card-brand">{selected.brand}</span><h2>{selected.name}</h2><div className="catalog-detail-price">{money(selected.price)} {selected.oldPrice && <del>{money(selected.oldPrice)}</del>}</div><p>{selected.description}</p><ul><li><strong>SKU:</strong> {selected.sku}</li><li><strong>Tipo:</strong> {selected.attributes?.tipo_impressao}</li><li><strong>Formato:</strong> {selected.attributes?.formato}</li><li><strong>Disponível:</strong> {selected.stock} unidades</li></ul><div className="catalog-card-actions"><button className="catalog-button catalog-primary" type="button" onClick={() => addToCart(selected)}>Adicionar ao carrinho</button><button className="catalog-button catalog-whatsapp" type="button" onClick={() => orderProduct(selected)}>Pedir pelo WhatsApp</button></div></div></div></div></div>}

      {checkoutOpen && <div className="catalog-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCheckout(); }}><div className="catalog-modal catalog-checkout" role="dialog" aria-modal="true" aria-label="Confirmar pedido"><button className="catalog-icon-button catalog-close" type="button" onClick={closeCheckout} aria-label="Fechar confirmação">×</button><h2>{directProduct ? 'Pedir equipamento' : 'Confirmar pedido'}</h2><p>{directProduct ? `${directProduct.name} — ${money(directProduct.price)}. ` : ''}Ao finalizar, abriremos o WhatsApp com o resumo do pedido para confirmação.</p><form onSubmit={checkout}><label>Nome<input className="catalog-control" required value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label><label>Telefone<input className="catalog-control" type="tel" placeholder="(11) 99999-9999" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label><label>Observações<textarea className="catalog-control" rows="3" value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} /></label>{checkoutError && <p className="catalog-error" role="alert">{checkoutError}</p>}<button className="catalog-button catalog-primary" type="submit">Enviar pelo WhatsApp</button></form></div></div>}
    </div>
  );
}
