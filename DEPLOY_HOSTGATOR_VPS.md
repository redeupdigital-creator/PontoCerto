# Deploy na VPS Hostgator — passo a passo

Este guia parte do zero: sua VPS acabou de ser criada, você tem o IP e a
senha de root que a Hostgator te mandou por e-mail, e quer terminar com o
PontoCerto rodando em `https://seudominio.com.br`.

**O que eu preparei no projeto** (`ecosystem.config.js`, `nginx/pontocerto.conf`,
`scripts/setup-vps.sh`, `scripts/deploy.sh`) eu testei de verdade aqui:
subi a aplicação com PM2, matei o processo à força e confirmei que ele
reinicia sozinho, e validei a sintaxe de todos os scripts. **O que eu não
consigo fazer** é entrar na sua VPS e rodar os comandos por você — não
tenho acesso a ela. A partir daqui é você (ou quem for configurar) que roda
os comandos via SSH.

## 0. O que você precisa ter em mãos

- IP da VPS e senha de root (painel da Hostgator, ou e-mail de ativação).
- Um domínio ou subdomínio (ex.: `ponto.suaempresa.com.br`) já **apontado
  para o IP da VPS** — configure o registro DNS tipo `A` antes de começar
  (na Hostgator, isso fica em Domínios → Zona DNS; se o domínio for de
  outro provedor, configure lá). Sem isso, o certificado SSL no passo 5 vai
  falhar.
- As credenciais do banco de dados: se for usar Supabase (recomendado, já
  que o projeto já está preparado pra isso — ver `DEPLOY_SUPABASE_VERCEL.md`),
  a `DATABASE_URL` de lá. Se preferir um Postgres só seu, também dá — este
  guia assume Supabase por ser o caminho mais simples, mas indico a
  alternativa no passo 3.

## 1. Conectar na VPS

No seu computador (Windows: use o PowerShell, ou PuTTY):

```bash
ssh root@SEU_IP_AQUI
```

Digite a senha que a Hostgator te enviou. Isso te coloca dentro da VPS.

## 2. Subir os arquivos do projeto

Duas formas — use a que for mais fácil pra você:

**Opção A — via SCP (do seu computador, fora da VPS):**
```bash
scp -r PontoCerto root@SEU_IP_AQUI:/var/www/pontocerto
```

**Opção B — via Git** (se você colocar o projeto num repositório privado):
```bash
# já dentro da VPS
mkdir -p /var/www && cd /var/www
git clone SEU_REPOSITORIO_AQUI pontocerto
```

Em qualquer um dos dois casos, o projeto precisa acabar em `/var/www/pontocerto`
na VPS (se usar outro caminho, ajuste as referências abaixo).

## 3. Rodar o script de setup automatizado

```bash
cd /var/www/pontocerto
bash scripts/setup-vps.sh
```

O script vai perguntar o **domínio** e o **e-mail** (para o certificado SSL),
e depois fazer sozinho, na ordem:

1. Atualizar o sistema operacional.
2. Instalar Node.js 22, PM2, Nginx e Certbot.
3. Configurar o firewall (`ufw`) — só libera SSH, HTTP e HTTPS. A porta 3000
   (onde o Node roda) nunca fica exposta direto na internet.
4. Instalar as dependências do projeto (`npm install`).
5. Criar o `.env` a partir do `.env.example` e **pausar o script** pra você
   editar — é aqui que você preenche:

   ```bash
   # Se for usar Supabase (recomendado):
   DATABASE_URL=postgresql://postgres.xxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=sua-service-key
   SUPABASE_STORAGE_BUCKET=fotos-colaboradores

   # Se preferir Postgres local na própria VPS, em vez do Supabase:
   # DB_DIALECT=postgres
   # DB_HOST=localhost
   # DB_NAME=ponto_certo
   # DB_USER=postgres
   # DB_PASS=escolha-uma-senha-forte
   # (nesse caso, instale o Postgres antes: apt-get install -y postgresql,
   #  crie o banco e o usuário — não é feito pelo script)

   JWT_SECRET=gere-um-valor-aleatorio-forte-aqui
   TZ=America/Sao_Paulo
   NOTIFICACAO_GESTOR_EMAIL=rh@suaempresa.com.br   # opcional
   SMTP_HOST=...                                    # opcional, p/ e-mail
   ```

   Depois de editar e salvar (`Ctrl+O`, Enter, `Ctrl+X` se usar `nano`),
   volte pro terminal e aperte Enter pra continuar.

6. Configurar o site no Nginx.
7. Rodar as migrations do banco (`npx sequelize-cli db:migrate`).
8. Perguntar se quer rodar o `seed` (cria o usuário `admin`) — diga sim se
   for a primeira instalação, num banco vazio.
9. Subir a aplicação com PM2 e configurar pra iniciar sozinha se a VPS reiniciar.
10. Emitir o certificado SSL via Certbot.
11. Agendar o backup diário automático (3h da manhã).

## 4. Conferir se está no ar

```bash
curl https://seudominio.com.br/api/health
```

Deve responder `{"status":"ok","hora":"..."}`. Depois:

- Abra `https://seudominio.com.br/painel` no navegador (RH/admin).
- Abra `https://seudominio.com.br/app` no celular (bater ponto) e use
  "Adicionar à tela inicial" — nesse ponto o GPS já funciona de verdade,
  porque é HTTPS.

Login padrão criado pelo seed: `admin` / `admin123` — **troque essa senha
no primeiro acesso** (aba Minha Conta).

## 5. Comandos do dia a dia

```bash
pm2 status                    # ver se está rodando
pm2 logs pontocerto           # ver logs em tempo real
pm2 restart pontocerto        # reiniciar manualmente
pm2 monit                     # painel de CPU/memória ao vivo
```

## 6. Quando precisar atualizar o sistema (depois de mudanças no código)

```bash
cd /var/www/pontocerto
# suba os arquivos novos (scp/git pull) e depois:
bash scripts/deploy.sh
```

Isso faz backup automático antes, atualiza dependências, roda migrations
pendentes e reinicia o processo.

## 7. Diferença entre isso e o deploy na Vercel

Se em algum momento você decidir usar Vercel em vez da VPS (ou os dois, um
como principal e outro como contingência), o mesmo código funciona nos dois
— só muda a forma de hospedar:

| | VPS Hostgator (este guia) | Vercel |
|---|---|---|
| Processo | `src/server.js`, de longa duração, gerenciado pelo PM2 | Função serverless (`api/index.js`), sem processo fixo |
| Monitor de atraso | Roda sozinho via `setInterval` dentro do processo | Precisa de Cron Job da Vercel batendo numa rota protegida |
| Fotos de colaborador | Podem ficar em disco local (`uploads/`) ou Supabase Storage | Só Supabase Storage (disco não é persistente lá) |
| Custo de infra | Fixo (mensalidade da VPS) | Variável conforme uso |

Ambos usam a mesma `DATABASE_URL` (Supabase), então dá pra migrar de um pro
outro sem perder dado nenhum — é só reapontar o DNS.

## 8. Checklist de segurança antes de anunciar pro time

- [ ] Trocou a senha do usuário `admin` criado pelo seed.
- [ ] `JWT_SECRET` no `.env` é um valor aleatório forte, não o do `.env.example`.
- [ ] Testou o backup de verdade: `bash scripts/backup.sh` e confira se o
      arquivo foi gerado em `backups/`.
- [ ] Considerou desabilitar login de root via senha (usar só chave SSH) —
      prática básica de segurança para qualquer VPS exposta na internet,
      fora do escopo deste script.
- [ ] Se for usar Postgres local (não Supabase), configurou backup externo
      dele também (ver `BACKUP.md`).
