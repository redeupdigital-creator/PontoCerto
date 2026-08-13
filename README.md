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

Perfis de acesso: `colaborador`, `analista`, `coordenador`, `consulta`, `admin` (ver seção 4
para o que cada rota exige).

## 3. Principais endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login, retorna token JWT |
| GET/POST/PUT/DELETE | `/api/colaboradores` | CRUD de colaboradores (POST/PUT aceitam `multipart/form-data` com campo `foto`) |
| GET/PUT | `/api/batidas?colaboradorId=&mes=YYYY-MM` | Consultar batidas do mês / lançar (analista, coordenador, admin) |
| POST | `/api/batidas/bater` | Self-service: registra a batida de AGORA no próximo slot vazio do dia, com geolocalização opcional (usado pelo app mobile) |
| GET/POST | `/api/abonos` | Listar / solicitar abono de batida (colaborador só vê/solicita os próprios) |
| PATCH | `/api/abonos/:id/aprovar` | Aprovar abono (analista/coordenador/admin) — notifica o colaborador |
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
| GET | `/api/dashboard/hoje` | Painel ao vivo: status agora + faltas/atrasos do mês por colaborador (coordenador/consulta/admin) |
| GET | `/api/notificacoes` | Centro de notificações (colaborador vê as suas; demais perfis veem também as amplas) |
| PATCH | `/api/notificacoes/:id/lida` | Marcar notificação como lida |
| GET/POST/PUT/DELETE | `/api/usuarios` | Administração de logins (RH/admin; DELETE só admin) |
| PATCH | `/api/usuarios/me/senha` | Qualquer usuário troca a própria senha (exige senha atual) |
| PATCH | `/api/usuarios/:id/senha` | RH/admin reseta a senha de qualquer usuário |

## 4. Perfis de acesso

O sistema tem 5 perfis (`src/constants/perfis.js`), cada um com um escopo bem
delimitado — validado em `src/middleware/auth.js` e em cada rota via
`permitir(...)`:

| Perfil | O que pode fazer |
|---|---|
| `admin` | Acesso total: tudo dos perfis abaixo, mais gerenciar usuários (`/api/usuarios`) e configurações da empresa (`/api/empresa`, feriados). |
| `coordenador` | Operacional completo em **toda a empresa** (não é mais escopado por equipe): cadastra/edita colaborador, lança ponto, aprova abono, gerencia férias/atestado/ocorrência, vê e exporta relatórios. **Não** acessa usuários nem configurações da empresa/feriados. |
| `analista` | Lança e consulta **ponto e abono** de qualquer colaborador. **Não** cadastra colaborador, não acessa ausências nem relatórios. |
| `consulta` | Somente leitura: colaboradores, relatórios (inclusive exportar), cartão de ponto, ausências. Não cria/edita/aprova nada. |
| `colaborador` | Autoatendimento: só os próprios dados (cartão de ponto, batidas, abonos, ausências). Bate o próprio ponto pelo app. Qualquer tentativa de acessar dado de outro colaborador retorna `403`. |

Só `admin` pode excluir colaborador ou excluir registro de ausência — mesmo
`coordenador`, que já pode criar/editar, não exclui (ação sensível reservada
ao perfil de acesso total).

Essa matriz completa (quem pode fazer o quê, em cada módulo) foi validada com
um script de teste dedicado durante o desenvolvimento, cobrindo tanto as
ações permitidas quanto as proibidas para cada um dos 5 perfis — não só o
caminho feliz.

Lançamento direto de horário (`PUT /api/batidas`) fica restrito a
analista/coordenador/admin — o colaborador bate o próprio ponto pelo app
(`POST /api/batidas/bater`) ou reporta inconsistência via abono
(`POST /api/abonos`).

**Nota de migração:** os perfis antigos `gestor` e `rh` (de uma versão
anterior, que era escopada por equipe via `colaborador.gestorId`) foram
substituídos por este modelo. Uma migration (`20260811000015-refazer-perfis-usuarios.js`)
converte automaticamente logins existentes com esses perfis para
`coordenador` — revise manualmente se o mapeamento não fizer sentido pro seu
caso. O campo `gestorId` continua no cadastro do colaborador, mas hoje é
apenas informativo (não afeta mais o controle de acesso).

## 5. Administração de usuários

Toda a gestão de login é exclusiva do perfil `admin` — inclusive pela
interface, na aba **Usuários** (só aparece pra quem é admin):

- Cria, lista e edita usuários (`login`, `senha`, `perfil`, vínculo com
  `colaboradorId`). A resposta nunca inclui o hash da senha.
- Só aceita os 5 perfis válidos (`src/constants/perfis.js`) — tentar criar
  com um perfil fora da lista retorna `400`.
- Remoção de usuário é ação sensível: revoga acesso de alguém imediatamente.
- Qualquer usuário troca a **própria senha** via `PATCH /api/usuarios/me/senha`,
  confirmando a senha atual (testado: senha atual errada é rejeitada, e a
  senha antiga para de funcionar assim que a nova é definida).
- RH/admin podem **resetar a senha** de qualquer usuário (`PATCH
  /api/usuarios/:id/senha`) para o caso clássico de "esqueci minha senha".

## 6. Notificações

Toda solicitação de abono gera uma notificação **ampla** (visível para
analista/coordenador/admin) e toda aprovação/reprovação gera uma notificação **pessoal**
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
que aparece na interface.
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

### Módulo Admin (acesso completo a partir do celular)

Para qualquer perfil que não seja `colaborador`, uma 5ª aba **Admin**
aparece na barra inferior, abrindo um menu com as ferramentas de gestão —
cada uma adaptada ao formato mobile (cards e listas, em vez das tabelas
largas da tela desktop):

| Ferramenta | Quem vê |
|---|---|
| Painel ao Vivo | coordenador, consulta, admin |
| Colaboradores (ver/cadastrar) | analista, coordenador, consulta, admin |
| Registro de Ponto (lançar 1 dia) | analista, coordenador, admin |
| Ausências | coordenador, consulta, admin |
| Relatórios (com exportação Excel/PDF) | coordenador, consulta, admin |
| Feriados | coordenador, consulta, admin |
| Usuários | só admin |
| Auditoria | só admin |
| Compliance (AFD + integridade) | só admin |

O **admin** é o único perfil que vê as 9 ferramentas — cobrindo, a partir do
celular, tudo que também está disponível no painel desktop, com exceção de
Etiquetas (geração de etiqueta para colar no cartão físico ficou só no
painel desktop, por ser uma tarefa de impressão que não faz sentido no
celular).

Testado de ponta a ponta: visibilidade da aba por perfil (os 5 logins de
teste), as 9 ferramentas do admin carregando sem erro, cadastro de
colaborador funcionando de verdade, e exportação de relatório disparando o
download — tudo via simulação de navegador contra a API real, mais
conferência visual com Chromium.

**Bug real encontrado e corrigido durante esse teste**: a função `apiFetch`
do app mobile forçava `Content-Type: application/json` em toda chamada com
corpo, mesmo quando o corpo era um `FormData` (upload de foto/multipart) —
isso corrompia a requisição de cadastro de colaborador. Existia desde a
criação do app, só nunca tinha sido exercitado porque o mobile não tinha
nenhum formulário com upload até essa mudança. Corrigido para tratar
`FormData` como um caso especial, do mesmo jeito que o painel desktop já
fazia.

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
- Para uma **VPS (ex.: Hostgator)** com processo de longa duração gerenciado
  por PM2 + Nginx + SSL grátis (Let's Encrypt), siga **`DEPLOY_HOSTGATOR_VPS.md`**
  — inclui um script (`scripts/setup-vps.sh`) que automatiza a instalação
  inteira numa VPS Ubuntu/Debian nova, e `ecosystem.config.js`/`nginx/pontocerto.conf`
  já prontos. O `ecosystem.config.js` foi testado de verdade durante o
  desenvolvimento: subi a aplicação via PM2, matei o processo à força
  (`kill -9`) e confirmei que ele reinicia sozinho automaticamente.

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

## 16. Compliance trabalhista (AFD/Portaria 671), adicional noturno, intervalo mínimo, versionamento de jornada e auditoria

Essas 4 frentes foram implementadas a partir de uma análise de gaps do
sistema e testadas com evidência real (não só documentadas):

### AFD e NSR (Portaria 671/2021)
- `src/services/afd.js` gera o **AFD** (Arquivo Fonte de Dados) no leiaute
  oficial do Anexo V da Portaria 671/2021 (modo **REP-P**, já que este é um
  sistema de software). Implementação validada campo a campo por posição
  contra a especificação, incluindo:
  - **CRC-16/KERMIT** nos registros tipo 1, 2 e 5 — testado contra o vetor
    de teste oficial da própria Portaria (`CRC16("123456789") = 0x2189`).
  - **NSR** (Número Sequencial de Registro) e **cadeia de hash SHA-256**
    nos registros tipo 7 (marcação de ponto) — testado inclusive quanto à
    **detecção de adulteração**: alterei um registro direto no banco (fora
    da aplicação) e confirmei que `GET /api/afd/integridade` acusa
    corretamente onde a cadeia quebrou.
  - Registros tipo 5 (inclusão/alteração de empregado) são gerados a partir
    da trilha de auditoria — não existe um cadastro paralelo pra manter.
- **O que este software NÃO faz sozinho** (e é importante saber): não gera a
  assinatura digital CAdES/`.p7s` do AFD (exige certificado ICP-Brasil
  e-CNPJ da empresa — infraestrutura, não código) nem tem número de registro
  no INPI (exige homologação oficial do programa junto ao governo). O
  arquivo gerado sinaliza isso explicitamente no campo `avisos` da resposta
  da exportação, e a tela de Compliance mostra os mesmos avisos. **Recomenda-se
  validação por contador/consultoria trabalhista antes de uso em fiscalização.**
- Só a marcação feita pelo próprio colaborador (`POST /api/batidas/bater`)
  gera registro fiscal (tipo 7) — lançamento manual por RH/analista/
  coordenador (`PUT /api/batidas`) não fabrica uma marcação que não
  aconteceu; fica só na auditoria genérica, que é o mecanismo correto pra
  correções administrativas.
- Endpoints: `GET /api/afd/exportar?dataInicio=&dataFim=&formato=txt|json`,
  `GET /api/afd/integridade` — ambos exclusivos de admin. Tela: aba
  **Compliance**.

### Adicional noturno e intervalo mínimo
- `src/services/calculo.js` agora calcula, por dia: minutos trabalhados
  entre 22h–24h e o acréscimo de 20% (CLT art. 73), e se o intervalo entre
  a saída e a volta do almoço ficou abaixo de 1h em jornadas acima de 6h
  (CLT art. 71) — sinalizado como `intervaloInsuficiente`.
- **Limitação conhecida e documentada no código**: o cálculo de adicional
  noturno cobre só o trecho 22h–24h do mesmo dia civil da batida; turnos que
  atravessam a meia-noite (ex.: 22h–06h) não têm o trecho 00h–05h coberto,
  porque o modelo atual de batida (`e1/s1/e2/s2` por dia) representa um dia
  por registro. Evoluir isso é o item de maior prioridade se a empresa tiver
  turnos noturnos que cruzam a virada do dia.
- Testado com casos de horário conhecidos (ex.: 20h–23h → 60 min noturnos)
  antes de ir para o cálculo real via API.

### Versionamento de jornada
- Nova tabela `jornada_versoes`: cada colaborador tem um histórico de
  jornadas, cada uma vigente num período (`vigenciaInicio`/`vigenciaFim`).
  Alterar a jornada de alguém (`PUT /api/colaboradores/:id` com `jornada` e,
  opcionalmente, `jornadaVigenciaInicio`) fecha a versão anterior e abre uma
  nova — **sem reescrever o passado**.
- Testado de ponta a ponta: mudei a jornada de um colaborador de 8h para 6h
  com vigência futura, e confirmei que o mês anterior continuou calculando
  com 8h enquanto o mês seguinte já usa 6h.
- Migration com **backfill automático**: colaboradores já cadastrados antes
  dessa mudança ganham uma versão inicial com a jornada atual, vigente desde
  a admissão — testado recriando o cenário (colaboradores existentes antes
  da migration rodar).
- `GET /api/colaboradores/:id/jornadas` retorna o histórico completo.

### Auditoria geral
- Nova tabela `auditoria` + `src/services/auditoria.js`, plugados em todas
  as ações sensíveis: colaboradores (criar/editar/excluir), usuários
  (criar/editar/excluir/resetar senha, com perfil antes/depois), batidas
  (lançamento manual), abonos (aprovar/reprovar), férias/atestado/ocorrência
  (criar/editar/excluir) e dados da empresa (editar).
- Nunca bloqueia a operação principal se a gravação da auditoria falhar
  (mesmo padrão defensivo do serviço de notificações).
- `GET /api/auditoria?entidade=&entidadeId=&usuarioId=&dataInicio=&dataFim=`
  — exclusivo de admin. Testado confirmando que uma alteração feita por um
  coordenador aparece corretamente atribuída a ele na trilha. Tela: aba
  **Auditoria**, com filtro por entidade e período.

## 17. Painel ao Vivo (presença em tempo real + faltas/atrasos do mês)

Nova aba **Painel ao Vivo** (coordenador/consulta/admin — é a aba padrão ao
logar nesses perfis), com:

- **Status de agora** de cada colaborador: Presente, Presente (atrasado), No
  intervalo, Atrasado (ainda não bateu e já passou da tolerância), Ainda não
  iniciou, Concluiu o dia, Ausente (férias/atestado/suspensão), Abonado ou
  Folga — determinado por `src/services/dashboardAoVivo.js`, comparando o
  relógio atual com o **horário de entrada padrão** e a **tolerância** de
  cada colaborador (dois campos novos no cadastro).
- **Cards de resumo** (quantos presentes, atrasados, etc. agora) e uma
  tabela com **faltas e atrasos do mês corrente** por pessoa.
- Atualiza sozinho a cada 30 segundos enquanto a aba estiver aberta.
- Testado com 10 cenários de horário conhecidos na função pura de status
  (ex.: bateu às 08:20 com tolerância até 08:05 → "presente atrasado") antes
  de validar contra a API real, incluindo o status mudando de "atrasado"
  para "presente (atrasado)" no exato momento em que uma batida real acontece.

**Dois bugs reais encontrados e corrigidos durante essa implementação**
(o segundo foi descoberto justamente ao testar o cadastro pela interface,
não só por inspeção de código):

1. **Dias futuros do mês corrente contavam como falta.** `calcularMes`
   percorria o mês inteiro sem checar se o dia já tinha acontecido — todo
   dia depois de hoje, sem batida (porque ainda não chegou), era contado
   como falta. Corrigido: dias futuros não geram falta/atraso/intervalo
   insuficiente. Testado confirmando que, num mês com 21 dias futuros
   restantes, nenhum deles é contado.
2. **`toleranciaMin` podia virar string e quebrar contas.** Quando o
   colaborador é criado via formulário (multipart/form-data), o Sequelize
   só converte o campo `INTEGER` para número de verdade depois de uma nova
   leitura do banco — o objeto retornado *imediatamente* após `create()`
   ainda guardava o valor como string. Isso quebrava a soma
   `horaEntradaEsperada + tolerancia` (ex.: `480 + "10"` vira `"48010"` em
   JavaScript, não `490`). Corrigido com um `set()` customizado no model
   `Colaborador` que sempre grava como inteiro, e reforçado com `Number(...)`
   nos pontos de cálculo. Testado reproduzindo o cenário exato (POST via
   multipart, checando o tipo do campo na resposta imediata).

## 18. CPF obrigatório, escala cíclica, alerta de atraso, paginação e backup

Última rodada de melhorias, a partir de uma auditoria do sistema — 5 itens,
todos com evidência de teste real, incluindo dois bugs genuínos encontrados
(e corrigidos) durante o próprio processo de testar:

### CPF obrigatório e validado

Cadastro de colaborador agora exige CPF (`src/utils/cpf.js`), validado pelo
algoritmo oficial de dígitos verificadores — não é só "tem 11 números".
Testado contra CPFs de teste públicos conhecidos (`111.444.777-35`,
`529.982.247-25`) e contra tentativas de CPF inválido (rejeitado com `400`).

### Escala cíclica (12x36, 6x1, plantões)

Antes, a jornada só sabia representar "N horas por dia da semana" — não
cobria escalas que não seguem o dia da semana. Agora, cada versão de
jornada pode ser `semanal` (como sempre) ou `ciclica`, com um array de
horas por posição do ciclo (`[12,0]` = 12x36) e uma data de referência.
Testado matematicamente (inclusive datas anteriores à referência) e depois
criando um colaborador de verdade em 12x36 via API, confirmando que o
cartão de ponto alterna 12h/0h corretamente dia após dia.

### Alerta automático de atraso

`src/services/monitorAtrasos.js` verifica periodicamente quem está com
status "atrasado" no Painel ao Vivo e notifica — sem duplicar no mesmo dia.
Roda sozinho a cada 15 min em hospedagem tradicional (`src/server.js`); na
Vercel, é acionado por um Cron Job (`vercel.json`) batendo em
`GET/POST /api/dashboard/monitorar-atrasos`, protegido por `CRON_SECRET`
(a própria Vercel envia esse valor automaticamente como
`Authorization: Bearer` quando a variável de ambiente está configurada —
não precisa escrever o segredo em nenhum arquivo do repositório).

**Bug real encontrado e corrigido**: a checagem de "já notificado hoje"
comparava pelo `colaboradorId` do funcionário específico, mas a notificação
era criada com `colaboradorId: null` (pensada como "ampla") — nunca batiam,
e o monitor mandava notificação duplicada a cada execução. Corrigido para
usar o `colaboradorId` real (que também é visível para coordenador/admin,
já que a listagem deles não filtra por colaborador). Testado: 1ª chamada
notifica, 2ª e 3ª chamadas no mesmo dia não duplicam.

**Gap descoberto no processo**: não existia nenhuma tela de notificações no
sistema — só o endpoint. Criada a aba **Notificações**, com badge de não
lidas no menu (atualiza a cada 60s) e marcação de lida — sem isso, o alerta
de atraso seria invisível na prática.

### Paginação e performance

- `GET /api/auditoria` agora pagina de verdade (`?limit=&pagina=`), com
  `X-Total-Count`/`X-Pagina`/`X-Total-Paginas` nos headers de resposta
  (expostos via CORS).
- O Painel ao Vivo recalculava o mês inteiro de cada colaborador a cada 30s
  de atualização automática — caro numa empresa maior. Agora
  `calcularMes` tem um cache em memória (TTL de 5 min como rede de
  segurança), **invalidado imediatamente** sempre que algo que afeta o
  cálculo muda: lançar/bater ponto, aprovar/reprovar abono, criar/editar/
  excluir férias/atestado/ocorrência. Testado o cenário que importava: editar
  uma batida e consultar o cartão de ponto imediatamente depois — o total
  mudou na hora, sem esperar os 5 minutos do TTL.

### Política de backup

`scripts/backup.sh` e `scripts/restore.sh` (também disponíveis como
`npm run backup` / `npm run restore`), com detecção automática de
SQLite/Postgres/Supabase a partir do `.env`. **Testado de verdade**: gerei
um backup, alterei um dado (simulando um desastre), restaurei, e confirmei
que o dado voltou ao valor original. A política completa — frequência,
retenção, backup automático da Supabase vs. cron manual em VPS, e o
procedimento de testar a restauração periodicamente — está em
**`BACKUP.md`**.

## 19. Refresh visual (identidade "tech" em todo o sistema)

A tela de login já tinha ganhado um visual moderno (inspirado no estilo
"FiscalOS": dark, gradiente ciano→roxo, padrão de pontos) numa rodada
anterior — mas só a tela de login. O resto do painel e o app mobile
continuavam com o visual antigo (cards planos, inputs padrão do navegador,
sidebar sólida sem profundidade, e uma inconsistência de ícones: as abas
mais antigas usavam números "01, 02..." enquanto as mais novas usavam
emoji). Essa rodada estende a mesma identidade visual para todo o sistema:

- **Sidebar do painel**: gradiente escuro com padrão de pontos (igual ao
  login), logo com ícone em caixa, item ativo com brilho ciano em vez de
  destaque plano.
- **Ícones consistentes**: todas as abas agora usam emoji temático (antes
  misturava números com emoji).
- **Botões primários**: gradiente ciano→roxo com leve elevação no hover, em
  vez do dourado plano.
- **Cards de estatística do Painel ao Vivo**: badge de ícone colorido com
  fundo suave (glow), em vez de só um emoji solto.
- **Inputs**: bordas arredondadas com anel de foco ciano, em vez do azul
  padrão do navegador.
- **App mobile**: tela de login redesenhada no mesmo estilo dark/gradiente
  (antes era só um cartão centralizado simples), cabeçalho e botão de bater
  ponto com o mesmo gradiente, indicador de aba ativa na barra inferior com
  uma barrinha de gradiente.

Testado visualmente (Chromium, antes/depois) e funcionalmente (jsdom) tanto
no painel quanto no app mobile — a mudança foi só de CSS/ícones, nenhuma
lógica de negócio foi tocada, e os testes confirmam que login, formulários e
o fluxo de bater ponto continuam funcionando normalmente.

## 20. Módulo de RH (folha, desligamento/recontratação, NR-1, EPI, anexos)

Rodada grande de expansão de RH, com evidência de teste real em cada parte:

### Folha de pagamento
Aba nova com dados cadastrais (salário, tipo de contrato, banco/agência/
conta/PIX — direto no cadastro de colaborador) e histórico de holerites
mensais com anexo em PDF. Testado via API real, incluindo a proteção contra
lançar dois holerites para a mesma competência (`409 Conflict`).

**Nota sobre os campos**: não recebi o arquivo de referência mencionado no
pedido — usei uma estrutura padrão de mercado. Se os campos reais forem
diferentes, é só uma migration adicional pra ajustar.

### Desligamento e recontratação
- Botão **Desligar** na lista de colaboradores (tipo, motivo, data, anexo
  do termo de rescisão) — grava um registro de histórico separado
  (`colaborador_desligamentos`) e marca o colaborador como inativo.
- Ao tentar cadastrar um colaborador com um **CPF que já existe como
  inativo**, o sistema detecta automaticamente e mostra um modal oferecendo
  **reativar o cadastro existente** em vez de duplicar — com o histórico de
  ponto, ausências e desligamentos anteriores todo preservado.
- Testado o ciclo completo pela interface: desliguei um colaborador,
  confirmei que sumiu do filtro "Ativos" e apareceu em "Desligados", tentei
  recadastrar o mesmo CPF e confirmei que o modal de recontratação apareceu
  com o nome certo, reativei, e confirmei o status voltando a "ativo".
- Relatório de Desligamentos, com exportação Excel/PDF.

### NR-1 (Gestão de Riscos Psicossociais)
Cadastro de ações (treinamento, palestra, ginástica laboral, avaliação de
risco), com carga horária e anexo de material/lista de presença. Ao
registrar a participação de um colaborador com horas de abono, o sistema
**gera automaticamente um Abono já aprovado** para aquele dia — testado
confirmando que o abono aparece na lista de abonos aprovados do colaborador
logo após registrar a presença, sem precisar de uma segunda aprovação manual.

### Solicitações de EPI
Colaborador pode solicitar EPI pra si mesmo; coordenador/admin podem
solicitar pra qualquer um e marcar como entregue. Relatório dedicado com
exportação.

### Anexos nas Ausências
As três sub-abas de Ausências (Férias, Atestados, Advertência/Suspensão)
agora aceitam anexo — recibo de férias, atestado médico, termo de
advertência/suspensão. Testado via API real nas três, com PDF de verdade.

**Bug real encontrado e corrigido nessa rodada**: o middleware de upload
existente só aceitava imagem (foi construído originalmente só para foto de
colaborador). Ao reaproveitá-lo para os anexos de documento (PDF), toda
tentativa de anexar um PDF era rejeitada com "Arquivo deve ser uma imagem".
Corrigido criando um segundo middleware (`uploadDocumento`, em
`src/middleware/upload.js`) que aceita PDF e imagem, usado em todas as
rotas novas de anexo — sem alterar o middleware original de foto, que
continua exigindo imagem (testado que ele ainda rejeita PDF corretamente).

## 21. Multi-empresa (Codismolas, AutoMolas, Nordeste)

O sistema passou de single-tenant (uma empresa implícita em tudo) para
multi-tenant de verdade — cada empresa só acessa os próprios dados, e o
usuário escolhe qual empresa antes de entrar. Retrofit grande, tocou quase
todo o backend; documentando aqui o que mudou e como validei cada parte.

### Modelo de dados
- Tabela `empresas` (substitui o antigo `empresa_config`, que era uma linha
  única implícita). `empresaId` foi adicionado direto em `colaboradores`,
  `usuarios`, `feriados`, `nr1_acoes`, `auditoria`, `notificacoes` e
  `registros_ponto_afd`; todo o resto (batidas, abonos, férias, holerites,
  EPI etc.) fica isolado indiretamente através do colaborador a quem pertence.
- **Login deixou de ser único globalmente** — agora é único **por empresa**
  (`admin` pode existir em Codismolas, AutoMolas e Nordeste ao mesmo tempo,
  são contas completamente separadas). Mesma mudança em feriados (duas
  empresas podem ter ambas um feriado em 25/12) e no NSR do AFD.
- Migration de backfill testada com dados reais: rodei o backfill com
  colaboradores/usuários já existentes de antes da mudança e confirmei que
  nenhum ficou órfão — todos migraram para uma empresa automaticamente.

### NSR do AFD agora é por empresa — não mais global
Cada empresa tem seu próprio arquivo fiscal perante a Portaria 671/2021, e
antes dessa mudança o contador do NSR era compartilhado entre todas as
empresas do sistema (um erro de isolamento sério, já que dois arquivos AFD
de empresas diferentes não podem compartilhar numeração). Testado de
verdade: bati ponto em um colaborador da Codismolas (NSR começou em 1),
bati ponto em um colaborador da AutoMolas (NSR também começou em 1, de
forma independente), e confirmei que o AFD exportado por cada empresa só
contém as marcações dela.

### Cadastro de empresa novo, direto da tela de login
`POST /api/empresas` é pública (sem login — como você entraria numa empresa
que ainda não existe?) e cria a empresa **e** o primeiro usuário admin dela
num só passo. Testado pela interface de ponta a ponta: abri o modal "Cadastrar
nova empresa" na tela de login, criei uma empresa nova, confirmei que ela
apareceu no seletor automaticamente, e fiz login nela na sequência.

### O que foi testado (não só implementado)
- **Vazamento cruzado**: cadastrei colaborador na Codismolas, confirmei que
  a AutoMolas recebe `404` ao tentar ver, editar, desligar ou lançar ponto
  para ele — testado em `colaboradores`, `batidas`, `abonos`, `ausências`,
  `usuários`, `auditoria`, `EPI`, `NR-1` e `holerites`.
- **Painel ao vivo e monitor de atraso**: o painel de uma empresa só mostra
  os próprios colaboradores; o monitor de atraso (cron) agora itera as 3
  empresas de forma independente, testado confirmando notificação gerada
  para cada uma separadamente.
- **Frontend**: seletor de empresa carregando as 3 do banco, login isolado
  (testei duas janelas simultâneas, uma logada em cada empresa, confirmando
  que a lista de colaboradores de uma não aparece na outra), e o app mobile
  com o mesmo fluxo.

### Dois bugs de constraint SQLite encontrados e corrigidos no processo
`changeColumn` do Sequelize no SQLite reconstrói a tabela inteira (não tem
`ALTER COLUMN` de verdade) — isso quebra qualquer foreign key que aponte
para a tabela alterada. Descobri isso tentando tornar `empresaId`
obrigatório em `colaboradores` (que tem mais de 10 tabelas dependentes) —
resolvido deixando a obrigatoriedade só na camada de aplicação. Já em
`usuarios` e `feriados` (que não têm nada apontando pra dentro delas),
`changeColumn` foi seguro de usar para trocar a unicidade global por
unicidade-por-empresa — validei isso tentando criar login/feriado
duplicado na mesma empresa (bloqueado) e em empresas diferentes (permitido).

### Seed atualizado
`node src/seed.js` agora cria as 3 empresas (Codismolas, AutoMolas,
Nordeste), cada uma com os 5 perfis de demonstração de sempre — 15 usuários
de teste no total, todos com o mesmo conjunto de logins (`admin`,
`paulo.mendes`, `fernanda.lima`, `ricardo.alves`, `maria.silva`), mas
completamente isolados por empresa.

## 22. Administrador do Sistema (super_admin)

Pedido: só um administrador (não qualquer um dos admins de cada empresa)
deveria poder cadastrar empresa nova, e esse administrador deveria conseguir
entrar em qualquer empresa. Implementar isso *sem* quebrar o isolamento que
tinha acabado de ser construído (o admin da Codismolas continuar sem ver
nada da AutoMolas) exigia um perfil à parte — não dava pra simplesmente
"turbinar" o perfil `admin` comum, porque ele existe em cada empresa
separadamente.

### Como funciona
- Novo perfil `super_admin` — não pertence a nenhuma empresa (`empresaId`
  fica `null`). Só existe um, criado pelo `seed.js` (**login `admin` / senha
  `super123`** — sim, é o mesmo login "admin" que existe em cada empresa,
  mas é uma conta completamente à parte: o que diferencia é a senha e o
  fato de não selecionar empresa nenhuma no login), e não pode ser
  concedido por um admin comum através da tela de Usuários (fica de fora da
  lista de perfis atribuíveis).
- Na tela de login, um link **"Sou administrador do sistema"** esconde o
  seletor de empresa (o super_admin não escolhe uma pra logar — ele não
  pertence a nenhuma). Login sem `empresaId` no corpo da requisição só
  autentica esse perfil.
- Depois de logado, o super_admin só vê duas abas: **Empresas** (cadastrar
  empresa nova + lista de todas com botão "Entrar →") e **Minha Conta**.
  Nenhuma ferramenta operacional (colaboradores, ponto, relatórios...)
  aparece nesse contexto — ele não tem uma empresa selecionada ainda.
- **Entrar numa empresa**: `POST /api/auth/entrar-empresa` — o super_admin
  não precisa saber a senha do admin local; o backend emite um token novo
  já "como admin" daquela empresa. Esse token tem exatamente o formato de
  um login normal, então **toda rota existente continua funcionando sem
  nenhuma alteração** — o super_admin passa a operar a empresa através do
  mesmíssimo código que qualquer admin comum usa.
- Um botão **"← voltar"** no rótulo da empresa (sidebar) retorna pra tela de
  Administração do Sistema sem precisar logar de novo — o token original do
  super_admin fica guardado em memória (nunca salvo em disco) enquanto ele
  estiver "dentro" de uma empresa.

### Testado de ponta a ponta (8 verificações pela interface real)
Ativei o modo super_admin, logei sem empresa, confirmei que só as abas
Empresas/Conta aparecem, cadastrei uma empresa nova pela tela, entrei na
Codismolas sem saber a senha do admin dela, confirmei que os 5 colaboradores
certos apareceram (prova de que o isolamento continua intacto mesmo
entrando via super_admin), voltei pra Administração do Sistema sem logar
de novo, e confirmei que um admin comum continua sem ver a aba Empresas.

**Um "bug" que investiguei durante os testes e não era bug**: a última
verificação (admin comum não vê a aba Empresas) falhou na primeira
tentativa — mas era o próprio script de teste que tinha deixado o modo
"super administrador" ligado da etapa anterior, então o login estava sendo
tentado do jeito errado. Corrigi o teste, não o produto, e confirmei de novo.

## 23. Próximos passos sugeridos

- Trocar `sequelize.sync()` por migrations antes de ir para produção.
- Adicionar testes automatizados (Jest + Supertest) para as regras de cálculo.
- Integrar com relógio de ponto físico homologado (protocolo REP-P) se for
  substituir um relógio biométrico existente.

---

**Desenvolvido por Danilo Cruz**
