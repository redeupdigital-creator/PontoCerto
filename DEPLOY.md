# Deploy em produção

Este guia cobre 3 caminhos, do mais simples ao mais controlado. Em todos os
casos o código é exatamente o mesmo — só muda onde ele roda.

## Opção A — Docker Compose (local ou VPS própria)

Sobe a API **e** um banco Postgres junto, com um único comando. Bom para testar
localmente em condições parecidas com produção, ou para rodar em uma VPS.

```bash
docker compose up --build
```

Isso vai:
1. Subir um Postgres 16 com o banco `ponto_certo` já criado.
2. Buildar a imagem da API.
3. Rodar as migrations automaticamente (`npx sequelize-cli db:migrate`) antes de iniciar o servidor (ver `Dockerfile`).
4. Deixar a API disponível em `http://localhost:3000`.

Depois de subir, crie o usuário admin (roda dentro do container):
```bash
docker compose exec api node src/seed.js
```

**Antes de ir para produção de verdade:** troque `JWT_SECRET` e a senha do
Postgres no `docker-compose.yml` (ou melhor, mova essas variáveis para um
arquivo `.env` que não vai pro controle de versão).

## Opção B — Render.com (mais simples, sem gerenciar servidor)

1. Suba este projeto para um repositório Git (GitHub/GitLab).
2. No Render, crie um **PostgreSQL** (Dashboard → New → PostgreSQL). Anote a
   "Internal Database URL".
3. Crie um **Web Service** apontando para o repositório:
   - Build command: `npm install`
   - Start command: `npx sequelize-cli db:migrate && npm start`
   - Runtime: Node
4. Em Environment, configure:
   ```
   DB_DIALECT=postgres
   DB_HOST=<host do Render>
   DB_PORT=5432
   DB_NAME=<nome do banco>
   DB_USER=<usuário>
   DB_PASS=<senha>
   JWT_SECRET=<gere um valor aleatório forte>
   SKIP_SYNC=true
   ```
   (o Render também oferece uma única `DATABASE_URL` — se preferir usá-la,
   ajuste `src/db.js` e `config/config.js` para aceitar essa variável em vez
   das 5 separadas).
5. Depois do primeiro deploy, rode o seed uma vez pelo Shell do Render:
   ```bash
   node src/seed.js
   ```

**Atenção ao upload de fotos:** discos em serviços como o Render são
efêmeros por padrão — arquivos em `uploads/` podem ser perdidos a cada
deploy. Para produção, ative um "Persistent Disk" no Render apontando para
`/app/uploads`, ou migre o upload de foto para um serviço de object storage
(S3, Cloudflare R2, etc.) trocando `src/middleware/upload.js`.

## Opção C — Railway.app

Fluxo é praticamente igual ao Render:
1. `railway init` no projeto, ou conecte o repositório pela interface web.
2. Adicione um plugin PostgreSQL (Railway provisiona e injeta as variáveis
   `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` automaticamente).
3. Mapeie essas variáveis para as que o projeto espera (`DB_HOST`, `DB_PORT`
   etc.) na aba Variables do serviço da API, ou ajuste `src/db.js` para ler
   as variáveis `PG*` diretamente.
4. Start command: `npx sequelize-cli db:migrate && npm start`.
5. Assim como no Render, configure um volume persistente para `uploads/` se
   for manter upload de foto em disco.

## Checklist antes de ir ao ar

- [ ] `JWT_SECRET` trocado para um valor aleatório forte (nunca o do `.env.example`).
- [ ] `SKIP_SYNC=true` em produção (as migrations, não o `sync()`, controlam o schema).
- [ ] Senha do usuário `admin` do seed trocada no primeiro acesso.
- [ ] CORS (`src/server.js`, `app.use(cors())`) restrito ao domínio do seu
      frontend, em vez de aberto para qualquer origem.
- [ ] Estratégia definida para armazenamento de fotos (disco persistente ou
      object storage) — disco efêmero perde os arquivos a cada deploy.
- [ ] Backup automático do Postgres configurado no provedor escolhido.
