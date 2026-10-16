import { getDatabase } from '@netlify/database';
import defaults from '../../backend/site-defaults.json' with { type: 'json' };
import catalogDefaults from '../../backend/catalog-defaults.json' with { type: 'json' };

const seed = { ...defaults, 'catalog-products': catalogDefaults, files: [], chats: [], messages: [], leads: [], users: [] };
const db = () => getDatabase();

export async function getDocument(collection, id) {
  const rows = await db().sql`SELECT data FROM site_documents WHERE collection = ${collection} AND id = ${id}`;
  return rows[0]?.data ?? null;
}

export async function putDocument(collection, id, data) {
  await db().sql`INSERT INTO site_documents (collection, id, data)
    VALUES (${collection}, ${String(id)}, ${JSON.stringify(data)}::jsonb)
    ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
  return data;
}

export async function deleteDocument(collection, id) {
  const rows = await db().sql`DELETE FROM site_documents WHERE collection = ${collection} AND id = ${String(id)} RETURNING id`;
  return rows.length > 0;
}

export async function getSingleton(collection) {
  const fallback = seed[collection] ?? [];
  await db().sql`INSERT INTO site_documents (collection, id, data)
    VALUES (${collection}, ${'_singleton'}, ${JSON.stringify(fallback)}::jsonb)
    ON CONFLICT (collection, id) DO NOTHING`;
  return (await getDocument(collection, '_singleton')) ?? fallback;
}

export async function putSingleton(collection, data) {
  return putDocument(collection, '_singleton', data);
}

export async function listDocuments(collection) {
  const rows = await db().sql`SELECT data FROM site_documents WHERE collection = ${collection} AND id <> ${'_singleton'} ORDER BY updated_at DESC`;
  return rows.map((row) => row.data);
}

export async function listChatMessages(chatId) {
  const rows = await db().sql`SELECT data FROM site_documents
    WHERE collection = ${'messages'} AND data->>'chatId' = ${String(chatId)}
    ORDER BY (data->>'createdAt')::bigint ASC`;
  return rows.map((row) => row.data);
}

export async function listAnalyticsEvents(from, to) {
  const rows = await db().sql`SELECT data FROM site_documents
    WHERE collection = ${'analytics-events'}
      AND (data->>'createdAt')::bigint >= ${from}
      AND (data->>'createdAt')::bigint <= ${to}`;
  return rows.map((row) => row.data);
}

export async function getCatalog() {
  const marker = await getDocument('catalog-meta', 'initialized');
  if (!marker) {
    for (const item of catalogDefaults) {
      await db().sql`INSERT INTO site_documents (collection, id, data)
        VALUES (${'catalog-products'}, ${String(item.id)}, ${JSON.stringify(item)}::jsonb)
        ON CONFLICT (collection, id) DO NOTHING`;
    }
    await putDocument('catalog-meta', 'initialized', { at: Date.now() });
  }
  return listDocuments('catalog-products');
}

export function defaultSettings() { return defaults.settings; }
