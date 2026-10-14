import { getStore } from '@netlify/blobs';

export default async function handler(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Metodo nao permitido', { status: 405 });
  const filename = decodeURIComponent(new URL(request.url).pathname.split('/').pop() || '');
  if (!/^[a-f0-9-]{36}-[a-zA-Z0-9._-]{1,100}$/.test(filename)) return new Response('Arquivo nao encontrado', { status: 404 });
  const result = await getStore('site-uploads').getWithMetadata(filename, { type: 'arrayBuffer' });
  if (!result?.data) return new Response('Arquivo nao encontrado', { status: 404 });
  const headers = { 'content-type': result.metadata?.contentType || 'application/octet-stream', 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' };
  return new Response(request.method === 'HEAD' ? null : result.data, { headers });
}
