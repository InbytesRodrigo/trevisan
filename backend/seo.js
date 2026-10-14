const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function siteBase(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.hostname === 'localhost') return '';
    return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
  } catch { return ''; }
}

function absoluteUrl(value, base) {
  if (!value) return '';
  try {
    const url = new URL(value, base ? `${base}/` : undefined);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function pageSeo(path, settings, products = []) {
  const brand = settings.brandName || 'GrupoTrevisan';
  const base = siteBase(settings.siteUrl);
  const pathname = new URL(path || '/', 'http://localhost').pathname.replace(/\/+$/, '') || '/';
  const privatePage = /^\/(admin|login|vendedor)(\/|$)/.test(pathname);
  const productId = pathname.match(/^\/equipamentos\/([^/]+)$/)?.[1];
  const product = productId && products.find((item) => String(item.id) === decodeURIComponent(productId) && item.active !== false);
  const isCatalog = pathname === '/equipamentos';
  const isHome = pathname === '/';
  const title = product
    ? product.seoTitle || `${product.name} | ${brand}`
    : isCatalog ? settings.seoCatalogTitle || `Equipamentos | ${brand}`
      : isHome ? settings.seoHomeTitle || `${brand} | Outsourcing de Equipamentos de TI`
        : brand;
  const description = product
    ? product.seoDescription || product.description || ''
    : isCatalog ? settings.seoCatalogDescription || 'Impressoras, multifuncionais, scanners e equipamentos de TI para empresas.'
      : isHome ? settings.seoHomeDescription || settings.tagline || ''
        : '';
  const canonical = base && !privatePage && (isHome || isCatalog || product)
    ? `${base}${isHome ? '/' : pathname}` : '';
  const image = absoluteUrl(product?.image || settings.seoImage || settings.logo || settings.heroImage, base);
  const logo = absoluteUrl(settings.logo || settings.footerLogo, base);
  const favicon = absoluteUrl(settings.favicon || '/favicon.png', base) || settings.favicon || '/favicon.png';
  const robots = privatePage || (!isHome && !isCatalog && !product) || settings.seoIndexing === false
    ? 'noindex, nofollow' : 'index, follow';
  const structuredData = [];
  if (isHome && base) {
    structuredData.push({
      '@context': 'https://schema.org', '@type': 'Organization',
      name: brand, url: `${base}/`, ...(logo ? { logo } : {}),
      ...(settings.phone ? { telephone: settings.phone } : {}),
      ...(settings.email ? { email: settings.email } : {}),
    });
    structuredData.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: brand, url: `${base}/` });
  }
  if (product && base) {
    structuredData.push({
      '@context': 'https://schema.org', '@type': 'Product',
      name: product.name, description: product.description || '',
      ...(image ? { image } : {}),
      ...(product.sku ? { sku: product.sku } : {}),
      ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
      ...(Number.isFinite(Number(product.price)) ? { offers: {
        '@type': 'Offer', url: canonical, priceCurrency: 'BRL', price: Number(product.price).toFixed(2),
        availability: Number(product.stock) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      } } : {}),
    });
  }
  return { title, description, canonical, image, favicon, robots, brand, verification: settings.googleSiteVerification || '', structuredData };
}

function renderSeoTags(path, settings, products = []) {
  const seo = pageSeo(path, settings, products);
  const meta = (name, content, type = 'name') => `<meta data-managed-seo="true" ${type}="${escapeHtml(name)}" content="${escapeHtml(content)}">`;
  const tags = [
    `<title data-managed-seo="true">${escapeHtml(seo.title)}</title>`,
    meta('description', seo.description),
    meta('robots', seo.robots),
    meta('og:type', 'website', 'property'),
    meta('og:site_name', seo.brand, 'property'),
    meta('og:title', seo.title, 'property'),
    meta('og:description', seo.description, 'property'),
    meta('twitter:card', seo.image ? 'summary_large_image' : 'summary'),
    meta('twitter:title', seo.title),
    meta('twitter:description', seo.description),
    `<link data-managed-seo="true" rel="icon" href="${escapeHtml(seo.favicon)}">`,
  ];
  if (seo.canonical) {
    tags.push(`<link data-managed-seo="true" rel="canonical" href="${escapeHtml(seo.canonical)}">`);
    tags.push(meta('og:url', seo.canonical, 'property'));
  }
  if (seo.image) {
    tags.push(meta('og:image', seo.image, 'property'));
    tags.push(meta('twitter:image', seo.image));
  }
  if (seo.verification) tags.push(meta('google-site-verification', seo.verification));
  for (const entry of seo.structuredData) {
    tags.push(`<script data-managed-seo="true" type="application/ld+json">${JSON.stringify(entry).replace(/</g, '\\u003c')}</script>`);
  }
  return tags.join('\n    ');
}

function renderSeoHtml(html, path, settings, products = []) {
  return html.replace('<!-- SEO_TAGS -->', renderSeoTags(path, settings, products));
}

module.exports = { siteBase, pageSeo, renderSeoTags, renderSeoHtml, escapeHtml };
