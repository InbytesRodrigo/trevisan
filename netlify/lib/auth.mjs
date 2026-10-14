import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { getDocument, putDocument } from './store.mjs';

const secret = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres');
  return process.env.JWT_SECRET;
};

export function issueToken(user) {
  return jwt.sign(publicUser(user), secret(), { expiresIn: '7d' });
}

export function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function currentUser(request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!token) return null;
  try {
    const claims = jwt.verify(token, secret());
    if (claims.id === 'admin-env') {
      const admin = await getDocument('admin-auth', 'primary');
      const email = admin?.email || process.env.ADMIN_EMAIL;
      return email?.toLowerCase() === claims.email?.toLowerCase() ? claims : null;
    }
    return await getDocument('users', claims.id);
  } catch { return null; }
}

export async function login(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const storedAdmin = await getDocument('admin-auth', 'primary');
  const adminEmail = String(storedAdmin?.email || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = storedAdmin?.password || process.env.ADMIN_PASSWORD;
  if (adminEmail && normalized === adminEmail && adminPassword &&
      bcrypt.compareSync(String(password || ''), adminPassword)) {
    const user = { id: 'admin-env', name: 'Administrador', email: adminEmail, role: 'admin' };
    return { token: issueToken(user), user };
  }
  const user = await getDocument('user-email', normalized);
  const record = user && await getDocument('users', user.id);
  if (!record || !bcrypt.compareSync(String(password || ''), record.password)) return null;
  return { token: issueToken(record), user: publicUser(record) };
}

export async function addUser({ name, email, password, role }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !name || !password || password.length < 12 || !['seller', 'admin'].includes(role)) throw new Error('Informe nome, e-mail, senha de ao menos 12 caracteres e perfil');
  const admin = await getDocument('admin-auth', 'primary');
  if (normalized === String(admin?.email || process.env.ADMIN_EMAIL || '').trim().toLowerCase() || await getDocument('user-email', normalized)) throw new Error('E-mail ja cadastrado');
  const user = { id: randomUUID(), name: String(name).trim(), email: normalized, role, password: bcrypt.hashSync(password, 12) };
  await putDocument('users', user.id, user);
  await putDocument('user-email', normalized, { id: user.id });
  return publicUser(user);
}

export async function changeAdminCredentials({ email, password }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !password || password.length < 12) throw new Error('Informe e-mail e senha de ao menos 12 caracteres');
  if (await getDocument('user-email', normalized)) throw new Error('E-mail ja cadastrado');
  const record = { email: normalized, password: bcrypt.hashSync(password, 12) };
  await putDocument('admin-auth', 'primary', record);
  return { id: 'admin-env', name: 'Administrador', email: normalized, role: 'admin' };
}
