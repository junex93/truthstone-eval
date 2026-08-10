# ARCHITECTURE

## Stack real

| Camada | Tecnologia |
| --- | --- |
| Framework | TanStack Start v1 (React 19, SSR) |
| Build | Vite 7 |
| Estilo | Tailwind CSS v4 via `src/styles.css` (tokens OKLCH) |
| Backend | Lovable Cloud (PostgreSQL + Auth + Storage) |
| Backend logic | TanStack Server Functions (`createServerFn`) |
| Validação | Zod compartilhado (`src/lib/validation/schemas.ts`) |
| Autorização | RLS + RPCs `SECURITY DEFINER` no PostgreSQL |

## Mapa de arquivos

```
src/
  lib/
    domain/constants.ts        vocabulário único (enums, transições, papéis)
    validation/schemas.ts      contratos Zod (mesmo schema no cliente e servidor)
    workspace.server.ts        autorização server-side, SHA-256, writeAudit
    workspace.functions.ts     bootstrap de organização, membros, dashboard
    cases.functions.ts         casos, imóvel avaliando, transição de status
    evidence.functions.ts      fontes, artefatos, extrações, campos, revisão
    datasets.functions.ts      composição e congelamento de dataset
    (não implementado)         camada de aplicação para market_properties,
                                market_observations, comparable_candidates e
                                property_match_candidates ainda não existe:
                                só há schema, triggers e RPCs no banco (ver
                                docs/PROPERTY_DATA_MODEL.md, docs/MARKET_
                                OBSERVATION_MODEL.md, docs/COMPARABLE_
                                GOVERNANCE.md, docs/GEO_MODEL.md)
  routes/
    __root.tsx                 shell raiz + captura de erro técnico
    index.tsx                  landing (princípios da plataforma)
    auth.tsx                   e-mail/senha + Google OAuth
    _authenticated/route.tsx   gate de sessão
    _authenticated/_shell/     dashboard, cases, evidence, datasets, admin, reports
                                (sem rotas de mercado/comparáveis nesta fase)
  integrations/supabase/       clientes gerados (não editar)
supabase/migrations/           histórico versionado do schema
tests/security/                testes negativos executáveis
docs/                          documentação normativa
```

## Fluxo de uma operação crítica (verificação de campo)

```
UI (botão desabilitado por papel — conveniência)
  -> server function verifyEvidenceField
       -> requireSupabaseAuth (bearer token validado no servidor)
       -> Zod parse
       -> requireReviewAccess (papel lido no banco, não no cliente)
       -> rpc verify_evidence_field  (SECURITY DEFINER, transação única):
              valida papel, exige nota técnica, exige evidência de suporte,
              grava evidence_reviews, grava revisão histórica (trigger),
              grava audit_log via audit_write_internal
```

Se o cliente tentar pular a server function e chamar a Data API direto, o
`GRANT` de `UPDATE` em `evidence_fields` não existe: a operação falha no banco.

## Camadas de defesa

1. **GRANT** — remove a capacidade de escrita direta em tabelas de decisão e prova.
2. **RLS** — isola tenant e papel.
3. **TRIGGER** — impõe invariantes (imutabilidade, linhagem, papel de OWNER).
4. **RPC `SECURITY DEFINER`** — única porta para operações oficiais, com
   justificativa obrigatória e auditoria transacional.
5. **Server function** — valida entrada e resolve papel antes de chamar a RPC.
6. **UI** — sinaliza permissões; nunca é a fonte da regra.

## Modo de execução do servidor

Server functions rodam em runtime serverless (Worker). Não há `child_process`,
`sharp` ou dependência de binário nativo. O hash SHA-256 do artefato é calculado
com WebCrypto lendo os bytes de volta do bucket privado — nunca no navegador.

## RPCs `SECURITY DEFINER` (visão consolidada)

| Domínio | RPC |
| --- | --- |
| Evidência | `verify_evidence_field`, `reject_evidence_field`, `revise_evidence_field` |
| Caso | `transition_case_status` |
| Dataset | `freeze_dataset` |
| Mercado/preço | `record_price_observation` |
| Fato canônico | `adopt_canonical_fact` |
| Duplicidade | `resolve_property_match` |
| Comparável | `decide_comparable` |
| Geografia (leitura) | `distance_between_properties_meters`, `distance_subject_to_market_property_meters` |

Detalhamento do domínio de imóvel/mercado/comparáveis em
`docs/PROPERTY_DATA_MODEL.md`, `docs/MARKET_OBSERVATION_MODEL.md`,
`docs/COMPARABLE_GOVERNANCE.md` e `docs/GEO_MODEL.md`.

## Storage

Buckets privados: `evidence-originals`, `property-media`, `generated-reports`.
Caminho canônico: `<organization_id>/<valuation_case_id>/<arquivo>`. As políticas
de storage validam os dois segmentos contra o banco (existência da organização e
do caso), não apenas o texto do path.
