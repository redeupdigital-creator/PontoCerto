# Política de Backup — PontoCerto

Este documento define como o backup do PontoCerto deve ser feito, dependendo
de onde o sistema está hospedado. Os scripts (`scripts/backup.sh` e
`scripts/restore.sh`) foram testados de verdade contra um banco SQLite:
gerei um backup, modifiquei um dado (simulando um desastre), restaurei, e
confirmei que o dado voltou ao estado original.

## O que precisa de backup

1. **Banco de dados** (a parte crítica — todo o resto pode ser reconstruído
   a partir do código-fonte). Contém: colaboradores, batidas, abonos,
   ausências, jornadas versionadas, auditoria, e a cadeia de marcações do
   AFD (que é, por design, imutável — perder isso é especialmente grave, já
   que ela é a evidência fiscal de ponto).
2. **Fotos de colaborador** — se estiver usando Supabase Storage, isso já
   tem redundância própria da Supabase (não precisa de backup adicional
   pelo PontoCerto). Se estiver usando o fallback de disco local
   (`uploads/`, só fora da Vercel), esse diretório também precisa entrar no
   backup.
3. **Não precisa de backup**: `node_modules`, os arquivos do próprio
   sistema (estão no Git), variáveis de ambiente (documentadas separadamente
   em local seguro, nunca commitadas).

## Frequência e retenção recomendadas

| Cenário | Frequência | Retenção |
|---|---|---|
| Produção (qualquer hospedagem) | Diária (automática, de madrugada) | 30 dias corridos + 1 backup por mês, guardado 12 meses |
| Antes de qualquer migration em produção | Manual, imediatamente antes | Guardar até confirmar que a migration deu certo |
| Desenvolvimento/homologação | Sob demanda | Não precisa reter |

**Por que 30 diários + 12 mensais**: cobre tanto "percebi um erro nas
últimas semanas" (granularidade diária) quanto "preciso comparar com um
estado de meses atrás" (os mensais), sem acumular um backup por dia pra
sempre.

## Como fazer, por tipo de hospedagem

### Supabase (recomendado para produção)

A Supabase já faz backup automático do Postgres:
- **Plano Free**: backups diários, retidos por 7 dias (não configurável).
- **Plano Pro ou superior**: backups diários configuráveis + **Point-in-Time
  Recovery (PITR)**, que permite restaurar para qualquer segundo dos últimos
  N dias (não só o snapshot da meia-noite) — vale a pena para produção de
  verdade, já que corrige o problema de "o erro aconteceu 3 horas depois do
  último snapshot".

**O que fazer:** se está em produção real na Supabase, é fortemente
recomendado estar no plano Pro (ou superior) especificamente pelo PITR.
Configurável em Project Settings → Database → Backups no painel da Supabase.
Isso cobre a política acima automaticamente — não é preciso rodar
`scripts/backup.sh` manualmente nesse caso, **exceto** antes de rodar uma
migration nova em produção (ver abaixo), como uma segunda camada de
segurança além do PITR.

### Docker / VPS / Render / Railway (Postgres próprio)

Nenhum backup automático existe por padrão — é preciso configurar:

```bash
# Agenda via cron do sistema operacional (Linux), todo dia às 3h da manhã:
0 3 * * * cd /caminho/do/PontoCerto && bash scripts/backup.sh /caminho/para/backups >> /var/log/pontocerto-backup.log 2>&1
```

Guarde os arquivos gerados (`.dump`) fora do mesmo servidor — copie para
outro storage (S3, Backblaze, outro VPS) periodicamente. Um backup que mora
só no mesmo disco que pode falhar não é um backup de verdade.

### SQLite (só para desenvolvimento)

SQLite **não deve ser usado em produção real** — é um banco de arquivo
único, sem replicação, sem backup automático de plataforma. `scripts/backup.sh`
funciona com ele (testado), mas é pensado para desenvolvimento/demonstração,
não para proteger dados de uma empresa de verdade.

## Antes de rodar uma migration em produção

Sempre, sem exceção:

```bash
bash scripts/backup.sh ./backups-pre-migration
npm run migrate
```

Se a migration der problema, restaure o backup feito segundos antes:

```bash
bash scripts/restore.sh ./backups-pre-migration/pontocerto_XXXXXXXX.dump
```

## Testando a restauração (faça isso periodicamente, não só quando precisar)

Um backup que nunca foi restaurado é uma suposição, não uma garantia. Ao
menos uma vez por trimestre:

1. Rode `scripts/backup.sh` contra produção.
2. Restaure esse backup num ambiente **separado** (nunca em produção) —
   local, ou um banco de homologação.
3. Confirme que os dados batem (`npm start` nesse ambiente restaurado e
   confira alguns registros conhecidos).

Isso foi literalmente o que validei durante o desenvolvimento: gerei um
backup, "estraguei" um dado de propósito, restaurei, e conferi que voltou —
o mesmo procedimento que a política pede que você repita periodicamente
contra dados reais.

## Segredos e credenciais (não são "dado", mas precisam de plano também)

`JWT_SECRET`, `DATABASE_URL`, `SUPABASE_SERVICE_KEY`, `CRON_SECRET` e
similares não entram no backup do banco — eles vivem nas variáveis de
ambiente da hospedagem (Vercel/Render/Railway/Docker). Guarde uma cópia
segura fora do código (um cofre de senhas, não um arquivo `.env` solto em
algum lugar) — se perder o acesso à plataforma de hospedagem, é assim que
você recupera a configuração pra reimplantar em outro lugar.
