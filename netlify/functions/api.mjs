import { randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import seo from '../../backend/seo.js';
import analytics from '../../backend/analytics.js';
import chatFlow from '../../backend/chat-flow.js';
import reviews from '../../backend/reviews.js';
import { addUser, changeAdminCredentials, currentUser, login, publicUser } from '../lib/auth.mjs';
import { defaultSettings, deleteDocument, getCatalog, getDocument, getSingleton, listAnalyticsEvents, listChatMessages, listDocuments, listVisibleChats, putDocument, putSingleton, updateChatPresence } from '../lib/store.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const fail = (message, status = 400) => json({ error: message }, status);
const cleanPath = (url) => {
  const path = new URL(url).pathname;
  return path.replace(/^\/(?:\.netlify\/functions\/api\/|api\/)/, '/');
};
const textResponse = (value, type = 'text/plain', status = 200) => new Response(value, { status, headers: { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' } });
const getBody = async (request) => {
  try { return await request.json(); } catch { return {}; }
};
const safeId = (value) => String(value || '').slice(0, 100);

async function permission(request, role = 'seller') {
  const user = await currentUser(request);
  if (!user) return { error: fail('Nao autenticado', 401) };
  if (role === 'admin' && user.role !== 'admin') return { error: fail('Acesso negado', 403) };
  return { user };
}

function chatStatus(chat) {
  if (chat.status === 'closed') return 'closed';
  const age = Date.now() - (chat.lastVisitorAt || chat.lastMessageAt || chat.createdAt);
  if (chat.unreadSeller > 0 && age > 600000) return 'overdue';
  if (chat.status === 'new') return 'new';
  if (chat.unreadSeller > 0) return 'waiting';
  return 'open';
}

function exposeChat(chat) {
  if (!chat) return chat;
  const { visitorKey, ...rest } = chat;
  return { ...rest, computedStatus: chatStatus(chat) };
}

export default async function handler(request) {
  try {
    const method = request.method;
    const path = cleanPath(request.url);
    const url = new URL(request.url);
    const parts = path.split('/').filter(Boolean);

    if (method === 'GET' && path === '/health') return json({ ok: true, storage: 'netlify-database' });

    if (method === 'GET' && path === '/settings') {
      return json({ ...defaultSettings(), ...await getSingleton('settings') });
    }
    if (method === 'PUT' && path === '/settings') {
      const { user, error } = await permission(request, 'admin'); if (error) return error;
      const current = await getSingleton('settings');
      const body = await getBody(request);
      const next = { ...current, ...body };
      await putSingleton('settings', next);
      return json(next);
    }

    if (method === 'GET' && path === '/catalog-products') return json(await getCatalog());
    if (parts[0] === 'catalog-products' && ((method === 'POST' && parts.length === 1) || (method === 'PUT' && parts.length === 2))) {
      const { error } = await permission(request, 'admin'); if (error) return error;
      const body = await getBody(request);
      if (!String(body.name || '').trim()) return fail('Informe o nome do produto');
      if (method === 'POST' && parts.length === 1) {
        await getCatalog();
        const item = { ...body, id: randomUUID(), createdAt: Date.now(), active: body.active !== false };
        await putDocument('catalog-products', item.id, item);
        return json(item);
      }
      if (method === 'PUT' && parts.length === 2) {
        const id = safeId(parts[1]);
        const current = await getDocument('catalog-products', id);
        if (!current) return fail('Produto nao encontrado', 404);
        const next = { ...current, ...body, id: current.id };
        await putDocument('catalog-products', id, next);
        return json(next);
      }
    }
    if (method === 'POST' && parts[0] === 'catalog-products' && parts[2] === 'delete') {
      const { error } = await permission(request, 'admin'); if (error) return error;
      return json({ ok: await deleteDocument('catalog-products', safeId(parts[1])) });
    }

    for (const collection of ['products', 'solutions', 'segments']) {
      if (method === 'GET' && path === `/${collection}`) return json(await getSingleton(collection));
      if (collection === 'solutions' && method === 'PUT' && path === '/solutions') {
        const { error } = await permission(request, 'admin'); if (error) return error;
        const body = await getBody(request);
        if (!Array.isArray(body)) return fail('Lista invalida');
        await putSingleton('solutions', body);
        return json(body);
      }
    }
    if (parts[0] === 'products' && ['POST', 'PUT'].includes(method)) {
      const { error } = await permission(request, 'admin'); if (error) return error;
      const body = await getBody(request);
      const products = await getSingleton('products');
      if (method === 'POST' && parts.length === 1) {
        const item = { id: randomUUID(), ...body };
        await putSingleton('products', [...products, item]); return json(item);
      }
      if (method === 'PUT' && parts.length === 2) {
        const index = products.findIndex((item) => String(item.id) === parts[1]);
        if (index < 0) return fail('Produto nao encontrado', 404);
        products[index] = { ...products[index], ...body, id: products[index].id };
        await putSingleton('products', products); return json(products[index]);
      }
    }
    if (method === 'POST' && parts[0] === 'products' && parts[2] === 'delete') {
      const { error } = await permission(request, 'admin'); if (error) return error;
      const items = await getSingleton('products');
      await putSingleton('products', items.filter((item) => String(item.id) !== parts[1]));
      return json({ ok: true });
    }

    if (method === 'GET' && path === '/seo-tags') {
      const settings = { ...defaultSettings(), ...await getSingleton('settings') };
      return new Response(seo.renderSeoTags(url.searchParams.get('path') || '/', settings, await getCatalog()), {
        headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex', 'cache-control': 'no-store' },
      });
    }
    if (method === 'GET' && path === '/robots.txt') {
      const settings = { ...defaultSettings(), ...await getSingleton('settings') };
      const base = seo.siteBase(settings.siteUrl);
      const lines = ['User-agent: *', 'Allow: /'];
      if (base && settings.seoIndexing !== false) lines.push(`Sitemap: ${base}/sitemap.xml`);
      return textResponse(`${lines.join('\n')}\n`);
    }
    if (method === 'GET' && path === '/sitemap.xml') {
      const settings = { ...defaultSettings(), ...await getSingleton('settings') };
      const base = seo.siteBase(settings.siteUrl);
      if (!base || settings.seoIndexing === false) return textResponse('Configure a URL oficial e ative a indexacao no painel.', 'text/plain', 404);
      const products = (await getCatalog()).filter((item) => item.active !== false);
      const urls = [`${base}/`, `${base}/equipamentos`, ...products.map((item) => `${base}/equipamentos/${encodeURIComponent(item.id)}`)];
      return textResponse(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((item) => `<url><loc>${seo.escapeHtml(item)}</loc></url>`).join('')}</urlset>`, 'application/xml');
    }

    if (method === 'POST' && path === '/auth/login') {
      const body = await getBody(request);
      const result = await login(body.email, body.password);
      return result ? json(result) : fail('Email ou senha invalidos', 401);
    }
    if (method === 'GET' && path === '/auth/me') {
      const { user, error } = await permission(request); return error || json(publicUser(user));
    }
    if (method === 'POST' && path === '/auth/admin-credentials') {
      const { error } = await permission(request, 'admin'); if (error) return error;
      try { return json(await changeAdminCredentials(await getBody(request))); }
      catch (cause) { return fail(cause.message); }
    }
    if (method === 'GET' && path === '/users') {
      const { error } = await permission(request, 'admin'); if (error) return error;
      const users = (await listDocuments('users')).map(publicUser);
      const admin = await getDocument('admin-auth', 'primary');
      if (admin?.email || process.env.ADMIN_EMAIL) users.unshift({ id: 'admin-env', name: 'Administrador', email: admin?.email || process.env.ADMIN_EMAIL, role: 'admin' });
      return json(users);
    }
    if (method === 'POST' && path === '/users') {
      const { error } = await permission(request, 'admin'); if (error) return error;
      try { return json(await addUser(await getBody(request))); }
      catch (cause) { return fail(cause.message); }
    }

    if (method === 'GET' && path === '/files') {
      const { error } = await permission(request); if (error) return error;
      return json(await listDocuments('files'));
    }
    if (method === 'POST' && path === '/upload') {
      const { error } = await permission(request); if (error) return error;
      const form = await request.formData();
      const file = form.get('file');
      if (!file || !file.name || file.size > 20 * 1024 * 1024) return fail('Arquivo obrigatorio ou maior que 20 MB');
      const allowed = /^(image\/(png|jpeg|webp|gif|x-icon|svg\+xml)|audio\/(mpeg|mp3|mp4|x-m4a|aac|ogg|webm|wav|x-wav|wave)|application\/pdf)$/;
      if (!allowed.test(file.type)) return fail('Tipo de arquivo nao permitido');
      const filename = `${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)}`;
      await getStore('site-uploads').set(filename, file, { metadata: { contentType: file.type } });
      const item = { id: randomUUID(), originalName: file.name, filename, url: `/uploads/${filename}`, mimetype: file.type, size: file.size, type: String(form.get('type') || 'file'), createdAt: Date.now() };
      await putDocument('files', item.id, item);
      return json(item);
    }
    if (method === 'POST' && parts[0] === 'files' && parts[2] === 'delete') {
      const { error } = await permission(request, 'admin'); if (error) return error;
      const item = await getDocument('files', safeId(parts[1]));
      if (!item) return fail('Arquivo nao encontrado', 404);
      await getStore('site-uploads').delete(item.filename);
      await deleteDocument('files', item.id);
      return json({ ok: true });
    }

    if (method === 'GET' && path === '/leads') {
      const { error } = await permission(request); if (error) return error;
      return json(await listDocuments('leads'));
    }
    if (method === 'POST' && path === '/leads') {
      const body = await getBody(request);
      const item = { id: randomUUID(), ...body, createdAt: Date.now() };
      await putDocument('leads', item.id, item); return json(item);
    }

    if (method === 'GET' && path === '/reviews') {
      const items = await listDocuments('reviews');
      return json(items.filter((item) => item.status === 'approved').sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0)).slice(0, 30));
    }
    if (method === 'POST' && path === '/reviews') {
      const clean = reviews.cleanReview(await getBody(request));
      if (clean?.ignored) return json({ ok: true }, 201);
      if (!clean) return fail('Informe nome, empresa, avaliação com ao menos 20 caracteres e autorize a publicação.');
      const item = { id: randomUUID(), ...clean, status: 'pending', createdAt: Date.now(), approvedAt: null };
      await putDocument('reviews', item.id, item);
      return json({ ok: true }, 201);
    }
    if (method === 'GET' && path === '/reviews/moderation') {
      const { error } = await permission(request, 'admin'); if (error) return error;
      return json((await listDocuments('reviews')).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    }
    if (method === 'PATCH' && parts[0] === 'reviews' && parts[1] && parts.length === 2) {
      const { error } = await permission(request, 'admin'); if (error) return error;
      const item = await getDocument('reviews', safeId(parts[1]));
      if (!item) return fail('Avaliação não encontrada', 404);
      const body = await getBody(request);
      if (!['pending', 'approved', 'rejected'].includes(body.status)) return fail('Status inválido');
      item.status = body.status;
      item.approvedAt = body.status === 'approved' ? Date.now() : null;
      await putDocument('reviews', item.id, item);
      return json(item);
    }

    if (method === 'POST' && path === '/analytics/events') {
      const event = analytics.cleanEvent(await getBody(request));
      if (!event) return fail('Evento invalido');
      await putDocument('analytics-events', randomUUID(), event);
      return json({ ok: true }, 201);
    }
    if (method === 'GET' && path === '/analytics') {
      const { error } = await permission(request, 'admin'); if (error) return error;
      const range = analytics.analyticsRange(url.searchParams.get('from'), url.searchParams.get('to'));
      if (!range) return fail('Periodo invalido');
      return json(analytics.summarizeAnalytics(await listAnalyticsEvents(range.from, range.to), range));
    }

    if (method === 'GET' && path === '/chats') {
      const { error } = await permission(request); if (error) return error;
      const recent = Date.now() - 30 * 60 * 1000;
      return json((await listVisibleChats(recent)).map(exposeChat).sort((a, b) => (b.lastVisitorAt || b.lastSeenAt || b.createdAt) - (a.lastVisitorAt || a.lastSeenAt || a.createdAt)));
    }
    if (method === 'POST' && path === '/chats') {
      const body = await getBody(request);
      const now = Date.now();
      const chat = { id: randomUUID(), visitorKey: randomUUID(), visitorName: String(body.visitorName || 'Visitante').slice(0, 100), visitorPhone: '', visitorEmail: '', visitorPage: String(body.visitorPage || '/').slice(0, 150), status: 'new', assignedTo: null, assignedName: null, lastMessage: '', lastMessageAt: null, lastSeenAt: now, createdAt: now, unreadSeller: 0, unreadVisitor: 0 };
      await putDocument('chats', chat.id, chat);
      return json({ ...exposeChat(chat), visitorKey: chat.visitorKey });
    }
    if (parts[0] === 'chats' && parts[1]) {
      const chat = await getDocument('chats', safeId(parts[1]));
      if (!chat) return fail('Chat nao encontrado', 404);
      const user = await currentUser(request);
      const visitorKey = request.headers.get('x-visitor-key') || url.searchParams.get('key');
      if (!user && visitorKey !== chat.visitorKey) return fail('Acesso negado', 403);
      if (method === 'GET' && parts.length === 2) return json(exposeChat(chat));
      if (method === 'POST' && parts[2] === 'presence' && !user) {
        const body = await getBody(request);
        await updateChatPresence(chat.id, Date.now(), String(body.visitorPage || chat.visitorPage || '/').slice(0, 150));
        return json({ ok: true });
      }
      if (method === 'GET' && parts[2] === 'messages') {
        return json(await listChatMessages(chat.id));
      }
      if (method === 'POST' && parts[2] === 'messages') {
        const body = await getBody(request);
        const value = String(body.text || '').trim().slice(0, 4000);
        const audioUrl = /^\/uploads\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,139}$/.test(String(body.audioUrl || '')) ? String(body.audioUrl) : '';
        if (!value && !audioUrl) return fail('Mensagem vazia');
        const automated = Boolean(body.automated) && !user;
        const chatSettings = automated ? { ...defaultSettings(), ...await getSingleton('settings') } : null;
        if (automated && !chatFlow.validAutomatedStep(body, chat, chatSettings)) return fail('Etapa automatica invalida', 403);
        const from = user || automated ? 'seller' : 'visitor';
        const flowStepId = automated ? String(body.flowStepId || '').slice(0, 80) : '';
        if (flowStepId) {
          const duplicate = (await listChatMessages(chat.id)).find((item) => item.flowStepId === flowStepId && item.automated);
          if (duplicate) return json(duplicate);
        }
        const message = { id: randomUUID(), chatId: chat.id, text: value, audioUrl, from, automated, flowStepId, senderName: user?.name || (automated ? String(chatSettings.chatAgentName || 'Atendimento').slice(0, 100) : chat.visitorName), createdAt: Date.now() };
        await putDocument('messages', message.id, message);
        chat.lastMessage = value || 'Mensagem de audio'; chat.lastMessageAt = message.createdAt;
        if (from === 'visitor') {
          for (const field of ['visitorName', 'visitorPhone', 'visitorEmail']) if (body[field]) chat[field] = String(body[field]).slice(0, 150);
          chat.lastVisitorAt = message.createdAt; chat.unreadSeller += 1;
          chat.lastSeenAt = message.createdAt;
          if (chat.status === 'closed') chat.status = 'open';
        } else if (!message.automated) {
          chat.unreadSeller = 0; chat.unreadVisitor += 1; chat.status = 'open';
        }
        await putDocument('chats', chat.id, chat);
        return json(message);
      }
      if (method === 'POST' && parts[2] === 'read') {
        if (user) chat.unreadSeller = 0; else chat.unreadVisitor = 0;
        await putDocument('chats', chat.id, chat); return json(exposeChat(chat));
      }
      if (method === 'POST' && ['assign', 'close'].includes(parts[2])) {
        if (!user) return fail('Acesso negado', 403);
        if (parts[2] === 'close') chat.status = 'closed';
        else { chat.status = 'open'; chat.assignedTo = user.id; chat.assignedName = user.name; }
        await putDocument('chats', chat.id, chat); return json(exposeChat(chat));
      }
    }

    return fail('Rota nao encontrada', 404);
  } catch (error) {
    console.error('API error', error);
    return fail('Erro interno. Tente novamente.', 500);
  }
}
