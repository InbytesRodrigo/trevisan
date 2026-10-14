import html from '../generated/index-html.mjs';
import seo from '../../backend/seo.js';
import { defaultSettings, getCatalog, getSingleton } from '../lib/store.mjs';

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || url.pathname;
    const settings = { ...defaultSettings(), ...await getSingleton('settings') };
    const products = await getCatalog();
    const tags = seo.renderSeoTags(path, settings, products);
    const page = html.replace(/<!-- SEO_START -->[\s\S]*?<!-- SEO_END -->/, `<!-- SEO_START -->${tags}<!-- SEO_END -->`);
    return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } });
  } catch (error) {
    console.error('Page error', error);
    return new Response('Erro ao carregar a pagina', { status: 500 });
  }
}
