import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const categories = [
  ['impressoras', 'Impressoras'],
  ['multifuncionais', 'Multifuncionais'],
  ['scanners', 'Scanners'],
  ['largo-formato', 'Largo Formato'],
];

const blank = {
  name: '', brand: '', category: 'impressoras', description: '', price: '', oldPrice: '',
  seoTitle: '', seoDescription: '',
  image: '', sku: '', stock: 0, active: true,
  attributes: { tipo_impressao: 'Colorido', formato: 'A4', volume_pagina: '15000' },
};

export default function CatalogAdmin() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  const reload = () => api('/api/catalog-products').then(setItems);
  useEffect(() => { reload().catch(() => setMessage('Não foi possível carregar o catálogo.')); }, []);
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setAttribute = (key, value) => setForm((current) => ({ ...current, attributes: { ...current.attributes, [key]: value } }));
  const edit = (product) => {
    setEditing(product.id);
    setForm({ ...blank, ...product, attributes: { ...blank.attributes, ...product.attributes } });
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const reset = () => { setEditing(null); setForm(blank); };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('type', 'product');
      const saved = await api('/api/upload', { method: 'POST', body });
      setField('image', saved.url);
    } catch (error) { setMessage(error.message); }
    finally { setUploading(false); event.target.value = ''; }
  };
  const save = async (event) => {
    event.preventDefault();
    const body = { ...form, price: Number(form.price), oldPrice: form.oldPrice === '' ? null : Number(form.oldPrice), stock: Number(form.stock) };
    try {
      await api(editing === null ? '/api/catalog-products' : `/api/catalog-products/${editing}`, { method: editing === null ? 'POST' : 'PUT', body: JSON.stringify(body) });
      await reload();
      reset();
      setMessage('Produto salvo no catálogo.');
    } catch (error) { setMessage(error.message); }
  };
  const remove = async (product) => {
    if (!window.confirm(`Excluir ${product.name} do catálogo?`)) return;
    try {
      await api(`/api/catalog-products/${product.id}/delete`, { method: 'POST' });
      await reload();
      if (editing === product.id) reset();
      setMessage('Produto excluído.');
    } catch (error) { setMessage(error.message); }
  };

  return <>
    <form className="panel" onSubmit={save}>
      <h3 style={{ marginBottom: 14 }}>{editing === null ? 'Novo equipamento' : 'Editar equipamento'}</h3>
      {message && <p className="ok" role="status" style={{ marginBottom: 12 }}>{message}</p>}
      <div className="row">
        <div className="field"><label>Nome</label><input required value={form.name} onChange={(event) => setField('name', event.target.value)} /></div>
        <div className="field"><label>Marca</label><input value={form.brand} onChange={(event) => setField('brand', event.target.value)} /></div>
        <div className="field"><label>Categoria</label><select value={form.category} onChange={(event) => setField('category', event.target.value)}>{categories.map(([slug, name]) => <option value={slug} key={slug}>{name}</option>)}</select></div>
      </div>
      <div className="field" style={{ marginTop: 12 }}><label>Descrição</label><textarea required value={form.description} onChange={(event) => setField('description', event.target.value)} /></div>
      <div className="row" style={{ marginTop: 12 }}>
        <div className="field"><label>Título para o Google</label><input placeholder="Opcional: usa o nome do produto" value={form.seoTitle || ''} onChange={(event) => setField('seoTitle', event.target.value)} /></div>
        <div className="field"><label>Descrição para o Google</label><input placeholder="Opcional: usa a descrição do produto" value={form.seoDescription || ''} onChange={(event) => setField('seoDescription', event.target.value)} /></div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <div className="field"><label>Preço (R$)</label><input type="number" min="0" step="0.01" required value={form.price} onChange={(event) => setField('price', event.target.value)} /></div>
        <div className="field"><label>Preço anterior (R$)</label><input type="number" min="0" step="0.01" value={form.oldPrice ?? ''} onChange={(event) => setField('oldPrice', event.target.value)} /></div>
        <div className="field"><label>Estoque</label><input type="number" min="0" required value={form.stock} onChange={(event) => setField('stock', event.target.value)} /></div>
        <div className="field"><label>SKU</label><input value={form.sku} onChange={(event) => setField('sku', event.target.value)} /></div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <div className="field"><label>Tipo de impressão</label><select value={form.attributes.tipo_impressao} onChange={(event) => setAttribute('tipo_impressao', event.target.value)}><option>Colorido</option><option>Monocromatico</option></select></div>
        <div className="field"><label>Formato</label><select value={form.attributes.formato} onChange={(event) => setAttribute('formato', event.target.value)}><option>A4</option><option>A3</option></select></div>
        <div className="field"><label>Volume de páginas por mês</label><input type="number" min="0" value={form.attributes.volume_pagina} onChange={(event) => setAttribute('volume_pagina', event.target.value)} /></div>
      </div>
      <div className="field" style={{ marginTop: 12 }}><label>URL da imagem</label><input value={form.image} onChange={(event) => setField('image', event.target.value)} /></div>
      <label className="drop" style={{ display: 'block', marginTop: 12 }}>{uploading ? 'Enviando imagem...' : 'Ou enviar imagem'}<input type="file" accept="image/*" hidden onChange={upload} /></label>
      {form.image && <img src={form.image} alt="Prévia do equipamento" style={{ height: 100, objectFit: 'contain', marginTop: 12 }} />}
      <label className="check"><input type="checkbox" checked={form.active !== false} onChange={(event) => setField('active', event.target.checked)} />Produto ativo</label>
      <div className="row" style={{ marginTop: 14 }}><button className="btn" type="submit">Salvar equipamento</button>{editing !== null && <button className="btn ghost" type="button" onClick={reset}>Cancelar edição</button>}</div>
    </form>
    <div className="panel"><h3 style={{ marginBottom: 14 }}>Equipamentos do catálogo</h3><div style={{ overflowX: 'auto' }}><table className="table"><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estado</th><th>Ações</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{categories.find(([slug]) => slug === item.category)?.[1] || item.category}</td><td>{Number(item.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td>{item.active === false ? 'Inativo' : 'Ativo'}</td><td><button className="btn ghost" type="button" onClick={() => edit(item)}>Editar</button> <button className="btn ghost" type="button" onClick={() => remove(item)}>Excluir</button></td></tr>)}</tbody></table></div></div>
  </>;
}
