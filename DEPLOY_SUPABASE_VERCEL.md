# Deploy com Supabase + Vercel

Este guia parte do zero: criar o projeto na Supabase, rodar as migrations
contra ele, e publicar tudo (API + painel admin + app mobile) na Vercel.

## 1. Criar o projeto na Supabase

1. Crie uma conta e um projeto em https://supabase.com/dashboard.
2. Em **Project Settings → Database**, copie a **Connection string** no modo
   **Transaction** (porta `6543`, com `?pgbouncer=true`). É essa que você vai
   usar, não a porta `5432` direta — em ambiente serverless (Vercel), cada
   invocação pode abrir uma conexão nova, e só o connection pooler da
   Supabase aguenta esse padrão sem esgotar o Postgres.
   Fica parecida com:
   ```
   postgresql://postgres.xxxxxxxxxxxx:[SUA-SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
3. Em **Project Settings → API**, copie:
   - `Project URL` → variável `SUPABASE_URL`
   - `service_role` key (**não** a `anon` key — essa fica só no backend, nunca
     no frontend) → variável `SUPABASE_SERVICE_KEY`

## 2. Criar o bucket de fotos no Supabase Storage

1. No dashboard da Supabase, vá em **Storage → New bucket**.
2. Nome: `fotos-colaboradores` (ou outro nome — se mudar, defina
   `SUPABASE_STORAGE_BUCKET` com o mesmo valor no passo 4).
3. Marque como **Public bucket** (as fotos de colaborador precisam ser
   exibidas diretamente por URL no painel e no app mobile).

## 3. Rodar as migrations contra a Supabase (uma vez, do seu computador)

```bash
cd PontoCerto
npm install
export DATABASE_URL="postgresql://postgres.xxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
npm run migrate
node src/seed.js   # opcional: cria o usuário admin e dados de exemplo
```

Confira no dashboard da Supabase (**Table Editor**) que as tabelas
apareceram. Esse passo só precisa ser repetido quando houver migrations
novas — não roda automaticamente a cada deploy na Vercel (ver `api/index.js`).

## 4. Publicar na Vercel

1. Suba a pasta `PontoCerto/` (com o `vercel.json`, `api/index.js`, `mobile/` e
   `sistema-ponto-integrado.html` que já vêm prontos) para um repositório Git.
2. Em https://vercel.com, **Add New → Project**, importe o repositório.
3. Em **Environment Variables**, configure:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | a connection string do passo 1 (modo Transaction, porta 6543) |
   | `JWT_SECRET` | um valor aleatório forte (`openssl rand -hex 32`, por exemplo) |
   | `JWT_EXPIRES_IN` | `8h` |
   | `SUPABASE_URL` | do passo 1 |
   | `SUPABASE_SERVICE_KEY` | do passo 1 |
   | `SUPABASE_STORAGE_BUCKET` | `fotos-colaboradores` (ou o nome que você usou) |
   | `TZ` | `America/Sao_Paulo` |
   | `NOTIFICACAO_GESTOR_EMAIL` | (opcional) e-mail que recebe aviso de abono pendente |
   | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | (opcional) para notificação por e-mail |

   Não defina `SKIP_SYNC` nem `DB_DIALECT` — o `api/index.js` nunca chama
   `sync()`, então essas variáveis não fazem efeito na Vercel.
4. Deploy. A Vercel detecta o `vercel.json` e monta automaticamente:
   - `https://seu-projeto.vercel.app/api/*` → a API (função serverless)
   - `https://seu-projeto.vercel.app/app` → o app mobile (PWA)
   - `https://seu-projeto.vercel.app/painel` → o painel administrativo

## 5. Testar

```bash
curl https://seu-projeto.vercel.app/api/health
```

Depois, abra `/painel` no navegador (desktop) para o RH/admin, e `/app` no
celular (aí sim o GPS funciona de verdade — é HTTPS) para bater ponto.

## Limitações a saber

- **Tempo de execução**: funções serverless da Vercel têm limite de duração
  (10s no plano Hobby/free, mais no Pro). Exportação de relatórios muito
  grandes em PDF/Excel pode esbarrar nisso — se acontecer, migre a
  exportação para uma fila/job assíncrono, ou hospede a API à parte (Docker/
  Render/Railway, que também já estão prontos — ver `DEPLOY.md`) e use a
  Vercel só para o front.
- **Cold start**: a primeira requisição depois de um tempo sem uso pode
  demorar um pouco mais (a função "acorda"). Chamadas seguintes são rápidas.
- **Sem cron nativo simples**: se no futuro você quiser lembretes automáticos
  (ex. "férias vencendo"), isso precisa de um Vercel Cron Job separado
  chamando um endpoint da API — não existe ainda neste projeto.
- **Migrations não rodam no deploy**: são responsabilidade sua, feitas
  manualmente (passo 3) sempre que houver uma nova migration no código antes
  de dar push. Isso é intencional — rodar migration automaticamente a cada
  cold start de função serverless é arriscado (concorrência entre invocações).
