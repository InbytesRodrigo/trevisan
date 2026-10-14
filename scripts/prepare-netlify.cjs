const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
const target = path.join(__dirname, '..', 'netlify', 'generated', 'index-html.mjs');
const html = fs.readFileSync(source, 'utf8');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `export default ${JSON.stringify(html)};\n`);
