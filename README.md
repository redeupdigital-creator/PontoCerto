# PontoCerto API — Backend do Sistema de Controle de Ponto

API REST em Node.js/Express que implementa o modelo de dados completo do sistema de
controle de ponto: cadastro de colaboradores (com foto), registro de batidas, abono
de batidas, férias, atestados, ocorrências disciplinares, feriados e os 4 relatórios,
além do endpoint que alimenta o Cartão de Ponto para impressão.

Roda em **SQLite** por padrão (zero configuração — não precisa instalar banco nenhum
para testar) e está pronta para migrar para **PostgreSQL** só trocando variáveis de
ambiente, sem mudar nenhuma linha de código.

## 1. Instalação

```bash
npm install
cp .env.example .env
npm run seed     # cria o usuário admin e um colaborador de exemplo
npm start        # sobe a API em http://localhost:3000
```

Usuário criado pelo seed:
- **login:** `admin`
- **senha:** `admin123`
- **perfil:** `admin` (acesso total)

## 2. Autenticação

Todas as rotas (exceto `/api/health` e `/api/auth/login`) exigem um token JWT.

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","senha":"admin123"}'
```

Use o `token` retornado no header `Authorization: Bearer <token>` em todas as
próximas chamadas.

Perfis de acesso: `colaborador`, `gestor`, `rh`, `admin` (ver `src/middleware/auth.js`
para o que cada rota exige).

## 3. Principais endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login, retorna token JWT |
| GET/POST/PUT/DELETE | `/api/colaboradores` | CRUD de colaboradores (POST/PUT aceitam `multipart/form-data` com campo `foto`) |
| GET/PUT | `/api/batidas?colaboradorId=&mes=YYYY-MM` | Consultar batidas do mês / lançar (RH, gestor, admin) |
| POST | `/api/batidas/bater` | Self-service: registra a batida de AGORA no próximo slot vazio do dia, com geolocalização opcional (usado pelo app mobile) |
| GET/POST | `/api/abonos` | Listar / solicitar abono de batida (colaborador só vê/solicita os próprios) |
| PATCH | `/api/abonos/:id/aprovar` | Aprovar abono (gestor/RH/admin) — notifica o colaborador |
| PATCH | `/api/abonos/:id/reprovar` | Reprovar abono — notifica o colaborador |
| GET/POST/PUT/DELETE | `/api/ausencias/ferias` | CRUD de férias (colaborador só vê as próprias) |
| GET/POST/PUT/DELETE | `/api/ausencias/atestados` | CRUD de atestados |
| GET/POST/PUT/DELETE | `/api/ausencias/ocorrencias` | CRUD de advertência/suspensão |
| GET/POST/DELETE | `/api/feriados` | CRUD de feriados |
| GET | `/api/relatorios/falta-atraso?mes=YYYY-MM` | Relatório de falta e atraso |
| GET | `/api/relatorios/ferias` | Relatório de férias |
| GET | `/api/relatorios/ocorrencias?tipo=advertencia\|suspensao` | Relatório de suspensão/advertência |
| GET | `/api/relatorios/atestados` | Relatório de atestado |
| GET | `/api/relatorios/:tipo/exportar?formato=xlsx\|pdf` | Exporta um relatório (`falta-atraso`, `ferias`, `ocorrencias`, `atestados`) em Excel ou PDF |
| GET/PUT | `/api/empresa` | Dados da empresa (razão social, CNPJ, atividade econômica) usados na etiqueta do cartão de ponto — leitura livre, edição só RH/admin |
| GET | `/api/cartao-ponto/:colaboradorId?mes=YYYY-MM` | Dados completos do cartão de ponto (colaborador só acessa o próprio) |
| GET | `/api/notificacoes` | Centro de notificações (colaborador vê as suas; RH/gestor/admin veem também as amplas) |
| PATCH | `/api/notificacoes/:id/lida` | Marcar notificação como lida |
| GET/POST/PUT/DELETE | `/api/usuarios` | Administração de logins (RH/admin; DELETE só admin) |
| PATCH | `/api/usuarios/me/senha` | Qualquer usuário troca a própria senha (exige senha atual) |
| PATCH | `/api/usuarios/:id/senha` | RH/admin reseta a senha de qualquer usuário |

## 4. Acesso self-service e escopo de equipe

- **Perfil `colaborador`**: só lê/solicita dados vinculados ao próprio
  `colaboradorId` (cartão de ponto, batidas, abonos, férias, atestados,
  ocorrências). Não acessa relatórios de gestão. Qualquer tentativa de acessar
  dado de outro colaborador retorna `403`.
- **Perfil `gestor`**: cada colaborador tem um `gestorId` (campo em
  `Colaborador`, ver seed). O gestor só acessa/aprova/consulta dados de quem
  ele lidera diretamente (`colaborador.gestorId === gestor.colaboradorId`) —
  isso vale para cartão de ponto, batidas, abonos (inclusive aprovar/reprovar),
  ausências e relatórios. Listagens sem filtro explícito já vêm
  automaticamente restritas à equipe dele.
- **Perfis `rh`/`admin`**: acesso irrestrito a todos os colaboradores.

A listagem (`GET /colaboradores`) e a busca individual (`GET /colaboradores/:id`)
seguem o mesmo escopo — um colaborador comum não consegue mais listar ou
buscar diretamente o cadastro de outra pessoa, nem um gestor ver quem não é
da sua equipe.

Toda essa lógica está centralizada em `src/middleware/auth.js`
(`apenasProprioColaborador`, `apenasProprioOuEquipe`, `idsDaEquipe`) e foi
testada durante o desenvolvimento com cenários de tentativa de acesso
indevido entre colaboradores e entre equipes diferentes — não só o caminho
feliz.

Lançamento direto de horário (`PUT /api/batidas`) continua restrito a
RH/gestor/admin — o colaborador reporta inconsistências pelo fluxo de
**Abono de Batidas**, que é auto-atendido (`POST /api/abonos`).

## 5. Administração de usuários

Antes só era possível criar login pelo `src/seed.js` (editando o banco
diretamente). Agora existe uma API completa em `/api/usuarios`:

- **RH/admin** criam, listam e editam usuários (`login`, `senha`, `perfil`,
  vínculo com `colaboradorId`). A resposta nunca inclui o hash da senha.
- Só um **admin** pode conceder o perfil `admin` a alguém — RH tentando criar
  outro admin recebe `403` (testado). Remoção de usuário também é
  admin-only, por ser uma ação sensível de revogar acesso.
- Qualquer usuário troca a **própria senha** via `PATCH /api/usuarios/me/senha`,
  confirmando a senha atual (testado: senha atual errada é rejeitada, e a
  senha antiga para de funcionar assim que a nova é definida).
- RH/admin podem **resetar a senha** de qualquer usuário (`PATCH
  /api/usuarios/:id/senha`) para o caso clássico de "esqueci minha senha".

## 6. Notificações

Toda solicitação de abono gera uma notificação **ampla** (visível para
RH/gestor/admin) e toda aprovação/reprovação gera uma notificação **pessoal**
para o colaborador — sempre registradas em `/api/notificacoes` (centro de
notificações in-app), e também por e-mail se houver SMTP configurado no
`.env` (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, etc. — ver `.env.example`).
Sem SMTP configurado, o envio de e-mail é pulado silenciosamente e a
notificação continua disponível no centro in-app — nenhuma operação falha por
causa disso (ver `src/services/notificacoes.js`).

## 7. Exportação de relatórios (Excel/PDF)

Os 4 relatórios podem ser baixados em `.xlsx` ou `.pdf`:

```
GET /api/relatorios/falta-atraso/exportar?formato=xlsx&mes=2026-08
GET /api/relatorios/ferias/exportar?formato=pdf
GET /api/relatorios/ocorrencias/exportar?formato=xlsx&tipo=suspensao
GET /api/relatorios/atestados/exportar?formato=pdf
```

A exportação reaproveita exatamente a mesma função que monta os dados da
tela (`src/routes/relatorios.js`), então o arquivo baixado nunca diverge do
que aparece na interface — e respeita o mesmo escopo de equipe do gestor
(testado: um gestor exportando não vê colaboradores de fora do time dele no
arquivo gerado). Implementado com `exceljs` (Excel) e `pdfkit` (PDF, com
paginação automática para relatórios longos), em `src/services/exportacao.js`.

No frontend integrado, os botões "Exportar Excel" / "Exportar PDF" na aba
Relatórios baixam o arquivo diretamente pelo navegador (autenticado com o
token da sessão).

## 8. App mobile (bater ponto com GPS)

Um app mobile web (PWA) fica em `mobile/`, servido pelo próprio backend em
`/app` — não precisa de build separado nem de loja de aplicativo.

- **Bater ponto**: tela principal com relógio ao vivo, os 4 horários do dia
  (entrada, saída/volta de intervalo, saída) e um botão grande que registra
  o horário atual automaticamente no próximo slot vazio, capturando
  geolocalização do navegador quando disponível (e seguindo sem GPS se o
  colaborador negar a permissão — a batida não fica bloqueada por isso).
- **Abono, Cartão de Ponto e Conta**: versões mobile simplificadas dos
  mesmos fluxos self-service do sistema web.
- Instalável na tela inicial do celular (`manifest.webmanifest` +
  `sw.js`), com cache do "shell" da interface para abrir instantaneamente —
  as chamadas de API nunca são cacheadas.

**Importante sobre GPS:** a API de geolocalização do navegador só funciona
em contexto seguro (HTTPS) ou em `localhost`. Abrir o app direto de um
arquivo local (`file://`) no celular não vai conseguir capturar localização
— funcione normalmente pra testar o resto do fluxo, mas o GPS só funciona
de verdade depois de hospedar a API com HTTPS (ver seção de Deploy). Depois
de hospedado, acesse `https://seu-dominio/app` pelo celular e use "Adicionar
à tela inicial" no navegador.

Testado de ponta a ponta (login, GPS mockado, sequência completa de 4
batidas, persistência da geolocalização no banco, cartão e abono) com jsdom
simulando o navegador contra a API real durante o desenvolvimento.

## 9. Etiqueta para o cartão de ponto físico

Para quem ainda usa um cartão de ponto físico pré-impresso (ex.: modelo Tholz
"TIPO 7A"), a aba **Etiquetas** (RH/admin) gera uma etiqueta com foto e os
dados do cabeçalho — Empregador/Razão Social, CNPJ, Atividade Econômica,
Empregado, Nº Registro, Nº CTPS, Função, Local do Trabalho, mês e quinzena —
pronta para imprimir e colar no cartão, em vez de preencher tudo à mão.

- Os dados da empresa (razão social/CNPJ/atividade) ficam salvos uma vez em
  `/api/empresa` e reaproveitados em todas as etiquetas.
- Os campos por colaborador (`numeroRegistro`, `ctps`, `localTrabalho`) foram
  adicionados ao cadastro de colaborador — se não preenchidos, a etiqueta usa
  a matrícula como Nº Registro e mostra "—" no resto.
- Como o tamanho físico exato do seu cartão pode variar, a largura e altura
  da etiqueta são **campos editáveis em cm** na tela — ajuste e reimprima até
  bater com o seu modelo. Um checkbox liga/desliga a borda tracejada de corte
  (desligue se for imprimir direto em papel adesivo pré-cortado).
- Suporta gerar em lote: marque vários colaboradores e a folha (A4, pronta
  para impressão) organiza uma etiqueta por pessoa automaticamente.

Testado de ponta a ponta (salvar dados da empresa, marcar colaboradores,
gerar e conferir o conteúdo real das etiquetas, alternar a linha de corte)
com jsdom simulando o navegador contra a API real.

## 10. Regra de cálculo (src/services/calculo.js)

Para cada dia do mês, o sistema:
1. Soma o tempo entre entrada/saída da manhã e da tarde → **horas trabalhadas**.
2. Compara com a jornada prevista do colaborador naquele dia da semana.
3. Se trabalhado < previsto → **atraso**, exceto se houver abono aprovado para o dia.
4. Se trabalhado > previsto → **hora extra**.
5. Se não há nenhuma batida, não há abono e não há férias/atestado/suspensão
   cobrindo o dia → **falta**.
6. Feriados zeram a jornada prevista automaticamente.

Essa é a mesma lógica usada no protótipo front-end (`sistema-ponto.html`), agora
centralizada no backend para ser a fonte única da verdade.

## 11. Migrations (schema versionado)

O projeto já vem com migrations em `migrations/` (uma por tabela), testadas e
funcionando tanto em SQLite quanto em Postgres:

```bash
npm run migrate          # aplica as migrations pendentes
npm run migrate:status   # mostra o que já rodou
npm run migrate:undo     # desfaz a última migration
```

Em desenvolvimento, `npm start` continua usando `sequelize.sync()` por
padrão (conveniente, cria tudo automaticamente). Em produção, defina
`SKIP_SYNC=true` no `.env` e rode `npm run migrate` antes de subir o
servidor — assim o schema é sempre controlado por migrations versionadas,
nunca por `sync()`.

## 12. Migrando para PostgreSQL (produção)

Edite `.env`:
```
DB_DIALECT=postgres
DB_HOST=seu-host
DB_PORT=5432
DB_NAME=ponto_certo
DB_USER=seu-usuario
DB_PASS=sua-senha
SKIP_SYNC=true
```
Não é preciso alterar nenhum model nem migration — o Sequelize abstrai o
dialeto (`src/db.js` e `config/config.js` já leem essas variáveis para os
dois modos). Depois é só `npm run migrate && npm start`.

## 13. Docker e deploy

- `docker compose up --build` sobe a API **e** um Postgres juntos, localmente,
  já rodando as migrations automaticamente (ver `Dockerfile`).
- Para colocar em produção de verdade em servidor tradicional (Docker/VPS,
  Render ou Railway), siga o passo a passo em **`DEPLOY.md`**.
- Para rodar em **Supabase + Vercel** (banco gerenciado + hospedagem
  serverless), siga **`DEPLOY_SUPABASE_VERCEL.md`** — é uma arquitetura
  diferente (função serverless em vez de processo de longa duração, fotos no
  Supabase Storage em vez de disco local) e tem seu próprio guia.

## 14. Estrutura de pastas

```
api/
  index.js                 entrypoint da função serverless da Vercel (reexporta src/app.js)
src/
  app.js                   Express app puro (rotas, middlewares) — sem listen()/sync()
  server.js                wrapper que dá listen()+sync() no app.js, usado fora da Vercel
  db.js                    conexão com o banco (sqlite/postgres/Supabase via DATABASE_URL)
  seed.js                  popula usuário admin e dados de exemplo
  models/                  entidades (Colaborador, Batida, Abono, Ferias, Atestado,
                            Ocorrencia, Feriado, Usuario, Notificacao) e associações
  services/calculo.js       regra de negócio de apuração de ponto
  services/storage.js       upload de foto: Supabase Storage ou disco local, conforme configurado
  services/exportacao.js    geração de relatórios em Excel/PDF
  services/notificacoes.js  centro de notificações + e-mail opcional
  middleware/auth.js        autenticação JWT e controle de perfil/equipe
  middleware/upload.js      recebe o arquivo em memória (multer), delega a services/storage.js
  routes/                   rotas HTTP por módulo
uploads/                   fotos em disco local (só fora da Vercel; criado automaticamente)
mobile/                    app mobile web (PWA) — servido em /app
data/                      banco sqlite local (só em dev; criado automaticamente)
vercel.json                roteamento da Vercel (api/, mobile/, painel admin)
```

## 15. Frontend integrado

O arquivo `sistema-ponto-integrado.html` (entregue junto com este backend) já
consome esta API via `fetch`, incluindo tela de login com JWT e upload real de
foto do colaborador. Basta abrir o HTML no navegador com esta API rodando —
por padrão ele aponta para `http://localhost:3000/api` (editável na própria tela
de login, caso a API esteja em outro endereço).

## 16. Próximos passos sugeridos

- Trocar `sequelize.sync()` por migrations antes de ir para produção.
- Adicionar testes automatizados (Jest + Supertest) para as regras de cálculo.
- Integrar com relógio de ponto físico homologado (protocolo REP-P) se for
  substituir um relógio biométrico existente.
