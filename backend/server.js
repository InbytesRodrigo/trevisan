const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const { v4: uuidv4 } = require('uuid');
const catalogDefaults = require('./catalog-defaults.json');
const { siteBase, escapeHtml, renderSeoTags } = require('./seo');
const analytics = require('./analytics');
const chatFlow = require('./chat-flow');
const reviews = require('./reviews');

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString('hex');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

[DATA_DIR, UPLOAD_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const dbPath = (name) => path.join(DATA_DIR, `${name}.json`);

function readDB(name, fallback) {
  const file = dbPath(name);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeDB(name, data) {
  fs.writeFileSync(dbPath(name), JSON.stringify(data, null, 2));
}

const defaultChatFlow = [
  { id: 'f1', text: 'Oi, esta visitando nosso site', waitFor: 'none', typingMs: 1400 },
  { id: 'f2', text: 'Como vc se chama?', waitFor: 'name', typingMs: 1100 },
  { id: 'f3', text: 'Prazer, {name}! Em que posso te ajudar hoje?', waitFor: 'any', typingMs: 1600 },
  { id: 'f4', text: 'Show. Vou te conectar com um especialista agora, so um instante.', waitFor: 'none', typingMs: 1300 },
];

const defaultSettings = {
  brandName: 'GrupoTrevisan',
  tagline: 'Outsourcing de Equipamentos de TI para Empresas',
  heroTitle: 'Há 10 anos, líder em outsourcing de equipamentos de TI',
  heroSubtitle:
    'Quem tem a estrutura certa, navega com mais tranquilidade. O GrupoTrevisan e o parceiro de outsourcing de equipamentos ideal para a sua operacao.',
  heroCta: 'Conte com nossas solucoes',
  heroImage: '/img/hero.jpg',
  logo: '',
  logoWhite: '',
  footerLogo: '',
  toolbarColor: '',
  headerColor: '',
  footerColor: '',
  instagramHandle: '',
  favicon: '/favicon.png',
  siteUrl: '',
  seoHomeTitle: 'GrupoTrevisan | Outsourcing de Equipamentos de TI',
  seoHomeDescription: 'Soluções em impressoras, multifuncionais e equipamentos de TI para empresas, com suporte e gestão.',
  seoCatalogTitle: 'Equipamentos para Empresas | GrupoTrevisan',
  seoCatalogDescription: 'Conheça impressoras, multifuncionais, scanners e outros equipamentos para sua empresa.',
  seoImage: '/img/hero.jpg',
  googleSiteVerification: '',
  seoIndexing: true,
  phone: '(11) 99510-6569',
  whatsapp: '5511995106569',
  email: '',
  address: 'Rua Thales dos Santos Freire, 472 – São Bernardo do Campo, São Paulo - SP, 09751-020',
  footerText: 'GrupoTrevisan. Todos os Direitos Reservados.',
  chatEnabled: true,
  chatAutoOpen: true,
  chatOpenDelay: 10,
  chatAgentName: 'Mariana',
  chatAgentRole: 'Atendimento',
  chatAgentPhoto: '/img/agent.jpg',
  chatSound: true,
  chatWhatsappOption: false,
  chatFlow: defaultChatFlow,
};

const defaultUsers = process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD ? [{
  id: 'admin-0',
  name: 'Administrador',
  email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
  password: process.env.ADMIN_PASSWORD.startsWith('$2') ? process.env.ADMIN_PASSWORD : bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12),
  role: 'admin',
}] : [];

const defaultProducts = [
  {
    id: 'p1',
    name: 'Notebook Empresarial 14"',
    category: 'Notebooks e Desktops',
    description: 'Alta performance para backoffice, pontos de venda e home office.',
    image: '/img/notebook.jpg',
    featured: true,
    price: 'Sob consulta',
  },
  {
    id: 'p2',
    name: 'Multifuncional Laser Color',
    category: 'Impressoras e Multifuncionais',
    description: 'Agilidade e controle para imprimir, digitalizar e gerenciar documentos.',
    image: '/img/printer.jpg',
    featured: true,
    price: 'Sob consulta',
  },
  {
    id: 'p3',
    name: 'Smartphone Corporativo',
    category: 'Smartphones e Tablets',
    description: 'Mobilidade e seguranca para equipes de campo e atendimento.',
    image: '/img/phone.jpg',
    featured: true,
    price: 'Sob consulta',
  },
  {
    id: 'p4',
    name: 'Coletor de Dados Robusto',
    category: 'Automacao',
    description: 'Rastreabilidade em tempo real mesmo em ambientes criticos.',
    image: '/img/scanner.jpg',
    featured: true,
    price: 'Sob consulta',
  },
];

const defaultSolutions = [
  {
    id: 's1',
    title: 'Impressoras e Multifuncionais',
    subtitle: 'TreviPrinter',
    description:
      'Agilidade e controle para imprimir, digitalizar e gerenciar documentos, com toda seguranca e protecao de dados.',
    color: '#0065ff',
  },
  {
    id: 's2',
    title: 'Smartphones e Tablets',
    subtitle: 'TreviMobile',
    description:
      'Conecte sua equipe com a locacao de smartphones e tablets configurados para o seu negocio.',
    color: '#00c5ff',
  },
  {
    id: 's3',
    title: 'Notebooks e Desktops',
    subtitle: 'TreviPC',
    description:
      'Solucao de locacao de notebooks e computadores, com todo suporte para otimizar os processos.',
    color: '#7100bb',
  },
  {
    id: 's4',
    title: 'Impressoras Termicas e Coletores',
    subtitle: 'TreviAutomation',
    description:
      'Equipamentos robustos para facilitar o acesso as informacoes em qualquer ambiente.',
    color: '#d000bb',
  },
];

const defaultSegments = [
  {
    id: 'g1',
    title: 'Logistica',
    image: '/img/logistica.jpg',
    description:
      'Do backoffice a entrega, passando pelo warehouse e o carregamento, automatize seus processos logisticos.',
  },
  {
    id: 'g2',
    title: 'Educacao',
    image: '/img/educacao.jpg',
    description:
      'Modernize seu campus com equipamentos pensados para o ambiente educacional.',
  },
  {
    id: 'g3',
    title: 'Saude',
    image: '/img/saude.jpg',
    description:
      'Tecnologia completa para clinicas, hospitais e laboratorios, da equipe medica ao backoffice.',
  },
  {
    id: 'g4',
    title: 'Varejo',
    image: '/img/varejo.jpg',
    description:
      'Mais autonomia aos clientes e produtividade no ponto de vendas com processos automatizados.',
  },
  {
    id: 'g5',
    title: 'Industria',
    image: '/img/industria.jpg',
    description:
      'Transforme as etapas de producao do backoffice ao recebimento e expedicao.',
  },
  {
    id: 'g6',
    title: 'Governo',
    image: '/img/governo.jpg',
    description:
      'Atendimento as demandas mais complexas com outsourcing para instituicoes publicas.',
  },
];

writeDB('settings', { ...defaultSettings, ...readDB('settings', defaultSettings) });
readDB('users', defaultUsers);
const existingProducts = readDB('products', defaultProducts);
if (Array.isArray(existingProducts) && existingProducts.length) {
  const withImages = existingProducts.map((p) => {
    const def = defaultProducts.find((d) => d.id === p.id);
    if (def && !p.image) return { ...p, image: def.image };
    return p;
  });
  writeDB('products', withImages);
}
const existingSegments = readDB('segments', defaultSegments);
if (Array.isArray(existingSegments) && existingSegments.length) {
  const withImages = existingSegments.map((p) => {
    const def = defaultSegments.find((d) => d.id === p.id);
    if (def && !p.image) return { ...p, image: def.image };
    return p;
  });
  writeDB('segments', withImages);
}
readDB('solutions', defaultSolutions);
readDB('catalog-products', catalogDefaults);
readDB('files', []);
readDB('chats', []);
readDB('messages', []);
readDB('leads', []);
readDB('reviews', []);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
  path: '/socket.io',
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Nao autenticado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalido' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  next();
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/seo-tags', (req, res) => {
  const settings = { ...defaultSettings, ...readDB('settings', defaultSettings) };
  const products = readDB('catalog-products', catalogDefaults);
  res.set('X-Robots-Tag', 'noindex').type('text/html').send(renderSeoTags(String(req.query.path || '/'), settings, products));
});

app.get('/robots.txt', (_req, res) => {
  const settings = { ...defaultSettings, ...readDB('settings', defaultSettings) };
  const base = siteBase(settings.siteUrl);
  const lines = ['User-agent: *', 'Allow: /'];
  if (base && settings.seoIndexing !== false) lines.push(`Sitemap: ${base}/sitemap.xml`);
  res.type('text/plain').send(`${lines.join('\n')}\n`);
});

app.get('/sitemap.xml', (_req, res) => {
  const settings = { ...defaultSettings, ...readDB('settings', defaultSettings) };
  const base = siteBase(settings.siteUrl);
  if (!base || settings.seoIndexing === false) return res.status(404).type('text/plain').send('Configure a URL oficial e ative a indexacao no painel.');
  const products = readDB('catalog-products', catalogDefaults).filter((product) => product.active !== false);
  const urls = [`${base}/`, `${base}/equipamentos`, ...products.map((product) => `${base}/equipamentos/${encodeURIComponent(product.id)}`)];
  const body = urls.map((url) => `<url><loc>${escapeHtml(url)}</loc></url>`).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
});

app.get('/api/settings', (_req, res) => {
  res.json({ ...defaultSettings, ...readDB('settings', defaultSettings) });
});

app.put('/api/settings', auth, adminOnly, (req, res) => {
  const current = readDB('settings', defaultSettings);
  const next = { ...current, ...req.body };
  writeDB('settings', next);
  res.json(next);
});

app.get('/api/products', (_req, res) => {
  res.json(readDB('products', defaultProducts));
});

app.get('/api/catalog-products', (_req, res) => {
  res.json(readDB('catalog-products', catalogDefaults));
});

app.post('/api/catalog-products', auth, adminOnly, (req, res) => {
  const products = readDB('catalog-products', catalogDefaults);
  const item = { ...req.body, id: uuidv4(), createdAt: Date.now(), active: req.body.active !== false };
  products.push(item);
  writeDB('catalog-products', products);
  res.json(item);
});

app.put('/api/catalog-products/:id', auth, adminOnly, (req, res) => {
  const products = readDB('catalog-products', catalogDefaults);
  const index = products.findIndex((product) => String(product.id) === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Nao encontrado' });
  products[index] = { ...products[index], ...req.body, id: products[index].id };
  writeDB('catalog-products', products);
  res.json(products[index]);
});

app.post('/api/catalog-products/:id/delete', auth, adminOnly, (req, res) => {
  const products = readDB('catalog-products', catalogDefaults).filter((product) => String(product.id) !== req.params.id);
  writeDB('catalog-products', products);
  res.json({ ok: true });
});

app.post('/api/products', auth, adminOnly, (req, res) => {
  const products = readDB('products', []);
  const item = { id: uuidv4(), ...req.body };
  products.push(item);
  writeDB('products', products);
  res.json(item);
});

app.put('/api/products/:id', auth, adminOnly, (req, res) => {
  const products = readDB('products', []);
  const idx = products.findIndex((p) => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Nao encontrado' });
  products[idx] = { ...products[idx], ...req.body, id: products[idx].id };
  writeDB('products', products);
  res.json(products[idx]);
});

app.post('/api/products/:id/delete', auth, adminOnly, (req, res) => {
  const products = readDB('products', []).filter((p) => p.id !== req.params.id);
  writeDB('products', products);
  res.json({ ok: true });
});

app.get('/api/solutions', (_req, res) => {
  res.json(readDB('solutions', defaultSolutions));
});

app.put('/api/solutions', auth, adminOnly, (req, res) => {
  writeDB('solutions', req.body);
  res.json(req.body);
});

app.get('/api/segments', (_req, res) => {
  res.json(readDB('segments', defaultSegments));
});

app.get('/api/files', auth, (_req, res) => {
  res.json(readDB('files', []));
});

app.post('/api/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatorio' });
  const files = readDB('files', []);
  const item = {
    id: uuidv4(),
    originalName: req.file.originalname,
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`,
    mimetype: req.file.mimetype,
    size: req.file.size,
    type: req.body.type || 'file',
    createdAt: Date.now(),
  };
  files.unshift(item);
  writeDB('files', files);
  res.json(item);
});

app.post('/api/files/:id/delete', auth, adminOnly, (req, res) => {
  const files = readDB('files', []);
  const item = files.find((f) => f.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Nao encontrado' });
  writeDB(
    'files',
    files.filter((f) => f.id !== req.params.id)
  );
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const users = readDB('users', defaultUsers);
  const user = users.find((u) => u.email === email);
  if (!user || !bcrypt.compareSync(password || '', user.password)) {
    return res.status(401).json({ error: 'Email ou senha invalidos' });
  }
  const token = jwt.sign(publicUser(user), JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: publicUser(user) });
});

app.get('/api/auth/me', auth, (req, res) => {
  const users = readDB('users', defaultUsers);
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(401).json({ error: 'Usuario nao encontrado' });
  res.json(publicUser(user));
});

app.post('/api/auth/admin-credentials', auth, adminOnly, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || password.length < 12) return res.status(400).json({ error: 'Informe e-mail e senha de ao menos 12 caracteres' });
  const users = readDB('users', []);
  const idx = users.findIndex((item) => item.id === req.user.id);
  if (idx < 0) return res.status(404).json({ error: 'Usuario nao encontrado' });
  if (users.some((item) => item.email === email && item.id !== req.user.id)) return res.status(400).json({ error: 'E-mail ja cadastrado' });
  users[idx] = { ...users[idx], email, password: bcrypt.hashSync(password, 12) };
  writeDB('users', users);
  res.json(publicUser(users[idx]));
});

app.get('/api/users', auth, adminOnly, (_req, res) => {
  res.json(readDB('users', []).map(publicUser));
});

app.post('/api/users', auth, adminOnly, (req, res) => {
  const users = readDB('users', []);
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || password.length < 12 || !['admin', 'seller'].includes(role)) {
    return res.status(400).json({ error: 'Informe nome, e-mail, senha de ao menos 12 caracteres e perfil' });
  }
  if (users.some((u) => u.email === email)) {
    return res.status(400).json({ error: 'Email ja cadastrado' });
  }
  const user = {
    id: uuidv4(),
    name,
    email,
    password: bcrypt.hashSync(password, 12),
    role: role || 'seller',
  };
  users.push(user);
  writeDB('users', users);
  res.json(publicUser(user));
});

app.get('/api/leads', auth, (_req, res) => {
  res.json(readDB('leads', []));
});

app.post('/api/analytics/events', (req, res) => {
  const event = analytics.cleanEvent(req.body);
  if (!event) return res.status(400).json({ error: 'Evento invalido' });
  const events = readDB('analytics-events', []);
  events.push({ id: uuidv4(), ...event });
  writeDB('analytics-events', events);
  res.status(201).json({ ok: true });
});

app.get('/api/analytics', auth, adminOnly, (req, res) => {
  const range = analytics.analyticsRange(req.query.from, req.query.to);
  if (!range) return res.status(400).json({ error: 'Periodo invalido' });
  res.json(analytics.summarizeAnalytics(readDB('analytics-events', []), range));
});

app.post('/api/leads', (req, res) => {
  const leads = readDB('leads', []);
  const lead = { id: uuidv4(), ...req.body, createdAt: Date.now() };
  leads.unshift(lead);
  writeDB('leads', leads);
  io.to('sellers').emit('lead:new', lead);
  res.json(lead);
});

app.get('/api/reviews', (_req, res) => {
  res.json(readDB('reviews', []).filter((item) => item.status === 'approved').sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0)).slice(0, 30));
});

app.post('/api/reviews', (req, res) => {
  const clean = reviews.cleanReview(req.body);
  if (clean?.ignored) return res.status(201).json({ ok: true });
  if (!clean) return res.status(400).json({ error: 'Informe nome, empresa, avaliação com ao menos 20 caracteres e autorize a publicação.' });
  const items = readDB('reviews', []);
  items.unshift({ id: uuidv4(), ...clean, status: 'pending', createdAt: Date.now(), approvedAt: null });
  writeDB('reviews', items);
  res.status(201).json({ ok: true });
});

app.get('/api/reviews/moderation', auth, adminOnly, (_req, res) => {
  res.json(readDB('reviews', []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
});

app.patch('/api/reviews/:id', auth, adminOnly, (req, res) => {
  if (!['pending', 'approved', 'rejected'].includes(req.body?.status)) return res.status(400).json({ error: 'Status inválido' });
  const items = readDB('reviews', []);
  const item = items.find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Avaliação não encontrada' });
  item.status = req.body.status;
  item.approvedAt = item.status === 'approved' ? Date.now() : null;
  writeDB('reviews', items);
  res.json(item);
});

app.get('/api/chats', auth, (_req, res) => {
  const recent = Date.now() - 30 * 60 * 1000;
  res.json(readDB('chats', []).filter((chat) => chat.lastVisitorAt || chat.visitorPhone || chat.visitorEmail || chat.lastSeenAt > recent)
    .map((chat) => { const { visitorKey, ...publicChat } = chat; return publicChat; })
    .sort((a, b) => (b.lastVisitorAt || b.lastSeenAt || b.createdAt) - (a.lastVisitorAt || a.lastSeenAt || a.createdAt)));
});

app.post('/api/chats/:id/presence', (req, res) => {
  const chats = readDB('chats', []);
  const chat = chats.find((item) => item.id === req.params.id);
  if (!chat) return res.status(404).json({ error: 'Chat nao encontrado' });
  if (req.headers['x-visitor-key'] !== chat.visitorKey) return res.status(403).json({ error: 'Acesso negado' });
  chat.lastSeenAt = Date.now();
  chat.visitorPage = String(req.body?.visitorPage || chat.visitorPage || '/').slice(0, 150);
  writeDB('chats', chats);
  res.json({ ok: true });
});

app.get('/api/chats/:id', (req, res) => {
  const chat = readDB('chats', []).find((item) => item.id === req.params.id);
  if (!chat) return res.status(404).json({ error: 'Chat nao encontrado' });
  let authorized = req.headers['x-visitor-key'] && req.headers['x-visitor-key'] === chat.visitorKey;
  try { if (req.headers.authorization) authorized = Boolean(jwt.verify(req.headers.authorization.replace(/^Bearer\s+/i, ''), JWT_SECRET)); } catch {}
  if (!authorized) return res.status(403).json({ error: 'Acesso negado' });
  const { visitorKey, ...publicChat } = chat;
  res.json(publicChat);
});

app.get('/api/chats/:id/messages', (req, res) => {
  const chat = readDB('chats', []).find((item) => item.id === req.params.id);
  if (!chat) return res.status(404).json({ error: 'Chat nao encontrado' });
  let authorized = req.headers['x-visitor-key'] && req.headers['x-visitor-key'] === chat.visitorKey;
  try { if (req.headers.authorization) authorized = Boolean(jwt.verify(req.headers.authorization.replace(/^Bearer\s+/i, ''), JWT_SECRET)); } catch {}
  if (!authorized) return res.status(403).json({ error: 'Acesso negado' });
  const messages = readDB('messages', []).filter((m) => m.chatId === req.params.id);
  res.json(messages);
});

app.post('/api/chats/:id/messages', (req, res) => {
  const chats = readDB('chats', []);
  const idx = chats.findIndex((chat) => chat.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Chat nao encontrado' });
  let user = null;
  try { if (req.headers.authorization) user = jwt.verify(req.headers.authorization.replace(/^Bearer\s+/i, ''), JWT_SECRET); } catch {}
  if (!user && req.headers['x-visitor-key'] !== chats[idx].visitorKey) return res.status(403).json({ error: 'Acesso negado' });
  const value = String(req.body?.text || '').trim().slice(0, 4000);
  const audioUrl = /^\/uploads\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,139}$/.test(String(req.body.audioUrl || '')) ? String(req.body.audioUrl) : '';
  if (!value && !audioUrl) return res.status(400).json({ error: 'Mensagem vazia' });
  const automated = Boolean(req.body.automated) && !user;
  const chatSettings = automated ? { ...defaultSettings, ...readDB('settings', defaultSettings) } : null;
  if (automated && !chatFlow.validAutomatedStep(req.body, chats[idx], chatSettings)) return res.status(403).json({ error: 'Etapa automatica invalida' });
  const messages = readDB('messages', []);
  const flowStepId = automated ? String(req.body.flowStepId || '').slice(0, 80) : '';
  if (flowStepId) {
    const duplicate = messages.find((item) => item.chatId === chats[idx].id && item.flowStepId === flowStepId && item.automated);
    if (duplicate) return res.json(duplicate);
  }
  const message = { id: uuidv4(), chatId: chats[idx].id, text: value, audioUrl, from: user || automated ? 'seller' : 'visitor', automated, flowStepId, senderName: user?.name || (automated ? String(chatSettings.chatAgentName || 'Atendimento').slice(0, 100) : chats[idx].visitorName), createdAt: Date.now() };
  messages.push(message);
  writeDB('messages', messages);
  chats[idx].lastMessage = value || 'Mensagem de audio';
  chats[idx].lastMessageAt = message.createdAt;
  if (user) { chats[idx].unreadSeller = 0; chats[idx].unreadVisitor = (chats[idx].unreadVisitor || 0) + 1; chats[idx].status = 'open'; }
  else if (!automated) {
    ['visitorName', 'visitorPhone', 'visitorEmail'].forEach((field) => { if (req.body[field]) chats[idx][field] = String(req.body[field]).slice(0, 150); });
    chats[idx].lastVisitorAt = message.createdAt;
    chats[idx].lastSeenAt = message.createdAt;
    chats[idx].unreadSeller = (chats[idx].unreadSeller || 0) + 1;
    if (chats[idx].status === 'closed') chats[idx].status = 'open';
  }
  writeDB('chats', chats);
  res.json(message);
});

app.post('/api/chats/:id/read', (req, res) => {
  const chats = readDB('chats', []);
  const idx = chats.findIndex((chat) => chat.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Chat nao encontrado' });
  let user = null;
  try { if (req.headers.authorization) user = jwt.verify(req.headers.authorization.replace(/^Bearer\s+/i, ''), JWT_SECRET); } catch {}
  if (!user && req.headers['x-visitor-key'] !== chats[idx].visitorKey) return res.status(403).json({ error: 'Acesso negado' });
  if (user) chats[idx].unreadSeller = 0; else chats[idx].unreadVisitor = 0;
  writeDB('chats', chats);
  res.json(chats[idx]);
});

app.post('/api/chats', (req, res) => {
  const chats = readDB('chats', []);
  const chat = {
    id: uuidv4(),
    visitorKey: uuidv4(),
    visitorName: req.body.visitorName || 'Visitante',
    visitorPhone: req.body.visitorPhone || '',
    visitorEmail: req.body.visitorEmail || '',
    visitorPage: String(req.body.visitorPage || '/').slice(0, 150),
    status: 'new',
    assignedTo: null,
    assignedName: null,
    lastMessage: '',
    lastMessageAt: null,
    lastSeenAt: Date.now(),
    createdAt: Date.now(),
    unreadSeller: 0,
    unreadVisitor: 0,
  };
  chats.unshift(chat);
  writeDB('chats', chats);
  io.to('sellers').emit('chat:new', chat);
  res.json(chat);
});

app.post('/api/chats/:id/assign', auth, (req, res) => {
  const chats = readDB('chats', []);
  const idx = chats.findIndex((c) => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Chat nao encontrado' });
  chats[idx].assignedTo = req.user.id;
  chats[idx].assignedName = req.user.name;
  chats[idx].status = 'open';
  writeDB('chats', chats);
  io.to('sellers').emit('chat:updated', chats[idx]);
  io.to(`chat:${chats[idx].id}`).emit('chat:updated', chats[idx]);
  res.json(chats[idx]);
});

app.post('/api/chats/:id/close', auth, (req, res) => {
  const chats = readDB('chats', []);
  const idx = chats.findIndex((c) => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Chat nao encontrado' });
  chats[idx].status = 'closed';
  writeDB('chats', chats);
  io.to('sellers').emit('chat:updated', chats[idx]);
  io.to(`chat:${chats[idx].id}`).emit('chat:updated', chats[idx]);
  res.json(chats[idx]);
});

function chatStatus(chat) {
  if (chat.status === 'closed') return 'closed';
  const age = Date.now() - (chat.lastVisitorAt || chat.lastMessageAt || chat.createdAt);
  if (chat.unreadSeller > 0 && age > 10 * 60 * 1000) return 'overdue';
  if (chat.status === 'new') return 'new';
  if (chat.unreadSeller > 0) return 'waiting';
  return 'open';
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
    } catch {
      socket.user = null;
    }
  }
  next();
});

io.on('connection', (socket) => {
  if (socket.user && (socket.user.role === 'seller' || socket.user.role === 'admin')) {
    socket.join('sellers');
  }

  socket.on('chat:join', (chatId) => {
    socket.join(`chat:${chatId}`);
  });

  socket.on('chat:leave', (chatId) => {
    socket.leave(`chat:${chatId}`);
  });

  socket.on('message:send', (payload) => {
    const { chatId, text, from, senderName } = payload || {};
    if (!chatId || !text) return;
    const chats = readDB('chats', []);
    const idx = chats.findIndex((c) => c.id === chatId);
    if (idx < 0) return;
    const isVisitor = from === 'visitor';
    const message = {
      id: uuidv4(),
      chatId,
      text: String(text).slice(0, 4000),
      from: isVisitor ? 'visitor' : 'seller',
      automated: from === 'bot' || payload.automated === true,
      senderName:
        senderName ||
        (isVisitor ? chats[idx].visitorName : socket.user?.name || 'Atendimento'),
      createdAt: Date.now(),
    };
    const messages = readDB('messages', []);
    messages.push(message);
    writeDB('messages', messages);

    chats[idx].lastMessage = message.text;
    chats[idx].lastMessageAt = message.createdAt;
    if (payload.visitorName) chats[idx].visitorName = payload.visitorName;
    if (payload.visitorPhone) chats[idx].visitorPhone = payload.visitorPhone;
    if (payload.visitorEmail) chats[idx].visitorEmail = payload.visitorEmail;
    if (message.from === 'visitor') {
      chats[idx].lastVisitorAt = message.createdAt;
      chats[idx].unreadSeller = (chats[idx].unreadSeller || 0) + 1;
      if (chats[idx].status === 'closed') chats[idx].status = 'open';
    } else if (!message.automated) {
      chats[idx].unreadSeller = 0;
      chats[idx].unreadVisitor = (chats[idx].unreadVisitor || 0) + 1;
      chats[idx].status = 'open';
    }
    chats[idx].computedStatus = chatStatus(chats[idx]);
    writeDB('chats', chats);

    io.to(`chat:${chatId}`).emit('message:new', message);
    io.to('sellers').emit('chat:updated', chats[idx]);
    if (message.from === 'visitor') {
      io.to('sellers').emit('message:notify', { chat: chats[idx], message });
    }
  });

  socket.on('chat:read', (chatId) => {
    const chats = readDB('chats', []);
    const idx = chats.findIndex((c) => c.id === chatId);
    if (idx < 0) return;
    if (socket.user) chats[idx].unreadSeller = 0;
    else chats[idx].unreadVisitor = 0;
    chats[idx].computedStatus = chatStatus(chats[idx]);
    writeDB('chats', chats);
    io.to('sellers').emit('chat:updated', chats[idx]);
  });
});

setInterval(() => {
  const chats = readDB('chats', []);
  let changed = false;
  chats.forEach((c) => {
    const next = chatStatus(c);
    if (c.computedStatus !== next) {
      c.computedStatus = next;
      changed = true;
      io.to('sellers').emit('chat:updated', c);
    }
  });
  if (changed) writeDB('chats', chats);
}, 15000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`GrupoTrevisan API on ${PORT}`);
});
