# GrupoTrevisan

Site React/Vite com painel administrativo, catálogo de equipamentos, carrinho com envio ao WhatsApp e chat de atendimento. O deploy de produção usa Netlify Functions, Netlify Database (Postgres) e Netlify Blobs para imagens e arquivos enviados pelo painel.

## Deploy

O projeto Netlify deve apontar para este repositório. O arquivo `netlify.toml` define o build, as Functions e as rotas. As migrações em `netlify/database/migrations` são aplicadas no ciclo de deploy do Netlify Database.

Configure no Netlify, em escopo de Functions:

- `JWT_SECRET`: segredo aleatório com ao menos 32 caracteres.
- `ADMIN_EMAIL`: e-mail de acesso inicial ao painel.
- `ADMIN_PASSWORD`: hash bcrypt da senha inicial (por exemplo, gerado com `bcryptjs.hashSync(senha, 12)`).

O administrador pode trocar e-mail e senha em **Admin → Acesso admin**. Depois do primeiro acesso, configure **Marca e logo → WhatsApp** para habilitar os pedidos e **SEO e Google → URL oficial** para ativar o sitemap e os links canônicos.

## Desenvolvimento

```bash
npm ci
npm --prefix frontend ci
npm run build
```

Para testar com o banco local do Netlify, use `netlify dev` e aplique as migrações com `netlify database migrations apply`. O antigo servidor Express em `backend/server.js` continua disponível para o preview local em Vite, mas a publicação usa as Functions em `netlify/functions`.
