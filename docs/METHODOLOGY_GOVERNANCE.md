# METHODOLOGY GOVERNANCE

Camada normativa da plataforma (Fase 6). Registra **qual metodologia existe, com
que fundamento e sob que autoridade** — e nada além disso. Nenhum número
avaliatório é produzido aqui.

## Cadeia canônica

```
SOURCE (fonte metodológica)
  -> ACCESS BASIS        base legítima de acesso ao texto
  -> VERIFICATION        metadados / conteúdo / localizador
  -> LOCATOR             cláusula, seção, página, figura, tabela
  -> RULE                regra metodológica (normativa ou controle interno)
  -> SPECIFICATION       especificação versionada com 18 seções
  -> COMPLETENESS        diagnóstico determinístico de requisitos e bloqueadores
  -> SUBMISSION          submissão pelo produtor
  -> INDEPENDENT REVIEW  revisor distinto do submissor
  -> APPROVAL            transição oficial para APPROVED
  -> CANONICAL MANIFEST  representação canônica ordenada da especificação
  -> SHA-256             selo do manifesto (specification_hash)
  -> FUTURE IMPLEMENTATION  (não existe ainda)
  -> FUTURE METHOD RUN      (não existe ainda)
```

Os dois últimos elos são declarados como **inexistentes**: aprovar especificação
não cria motor de cálculo.

## Quem pode fazer cada etapa

| Etapa | Papéis autorizados | Porta oficial |
| --- | --- | --- |
| Registrar fonte, localizador, regra, fórmula, parâmetro | OWNER, ADMIN, VALUER (`can_write`) | Data API sob RLS + triggers |
| Vincular artefato à fonte | OWNER, ADMIN, VALUER | trigger de linhagem obrigatória |
| Verificar metadados / conteúdo / localizador | OWNER, ADMIN, REVIEWER (`can_review`) | `verify_methodology_source` |
| Resolver conflito entre fontes | OWNER, ADMIN, REVIEWER | `resolve_methodology_source_conflict` |
| Submeter especificação | OWNER, ADMIN, VALUER | `submit_method_specification` |
| Aprovar especificação | OWNER, ADMIN, REVIEWER **distinto do submissor** | `approve_method_specification` |
| Rejeitar especificação | OWNER, ADMIN, REVIEWER | `reject_method_specification` |
| Diagnosticar completude | qualquer membro | `specification_completeness` |
| Conferir selo | qualquer membro | `verify_specification_integrity` |

A UI apenas desabilita botões. A autoridade é do banco.

## Camadas de imposição

1. **GRANT** — cliente não escreve em colunas de decisão (status, aprovador,
   hash, manifesto).
2. **RLS** — isolamento por organização; objetos globais têm `organization_id`
   nulo e são somente leitura para o tenant.
3. **TRIGGER** — imutabilidade pós-aprovação, linhagem organizacional do
   registro-pai, recusa de expressão executável, `METADATA_ONLY` sem verificação
   de conteúdo.
4. **RPC `SECURITY DEFINER`** — única porta das transições e verificações, com
   justificativa obrigatória e auditoria na mesma transação.
5. **Server function** — valida entrada (Zod) e resolve papel lendo o banco.

## Auditoria

Vocabulário canônico persistido em `audit_log.event_type`:

- `METHODOLOGY_SOURCE_VERIFIED`
- `METHODOLOGY_SOURCE_CONFLICT_RESOLVED`
- `METHOD_SPECIFICATION_SUBMITTED`
- `METHOD_SPECIFICATION_APPROVED`
- `METHOD_SPECIFICATION_REJECTED`

Um único evento cobre as três verificações de fonte; o tipo específico
(`METADATA_VERIFIED`, `CONTENT_VERIFIED`, `LOCATOR_VERIFIED`) vive no payload do
evento e na linha de `methodology_source_verifications`. Isso é desenho
intencional: o ato auditado é "fonte verificada", com a natureza da verificação
como atributo.

Cada evento é gravado na **mesma transação** da operação de negócio, com autor
derivado do token. A suíte prova PRE=0/POST=2 numa submissão+aprovação nova.

## Prova executável

`tests/functional/methodology-governance-flow.ts` — 161 asserções, 161 PASS.
