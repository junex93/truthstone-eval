# SECURITY

Princípio: **UI security != database security**. Toda invariante é imposta no
PostgreSQL. A UI não é considerada parte do perímetro de segurança.

## Superfícies de acesso

1. **Data API (PostgREST)** — alcançável diretamente com o token do usuário e a
   chave publicável. Tratada como hostil.
2. **Server functions** — validam bearer token no servidor, aplicam Zod e
   resolvem papel no banco.
3. **Storage API** — buckets privados com policies por path validado no banco.
4. **Service role** — apenas dentro de handlers de servidor
   (`client.server.ts`), nunca no cliente.

## GRANTs efetivos para `authenticated`

| Tabela | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| organizations, organization_members, profiles | sim | conforme RLS | conforme RLS | não |
| valuation_cases, properties, evidence_sources | sim | sim | sim (com triggers) | não |
| evidence_artifacts | sim | não | não | não |
| evidence_extractions | sim | sim | não | não |
| evidence_fields | sim | sim (candidato) | **não** | não |
| dataset_versions | sim | sim | **não** | não |
| dataset_items | sim | sim | não | sim (só se não congelado) |
| evidence_reviews, evidence_field_revisions | sim | **não** | não | não |
| audit_log, dataset_item_snapshots | sim | **não** | não | não |

`anon` não tem acesso a nenhuma tabela do domínio nem às RPCs oficiais.

## Operações oficiais (única porta de escrita para decisões)

| RPC | Exige | Auditoria transacional |
| --- | --- | --- |
| `verify_evidence_field` | `can_review`, nota técnica, evidência de suporte | `FIELD_VERIFIED` |
| `reject_evidence_field` | `can_review`, motivo | `FIELD_REJECTED` |
| `revise_evidence_field` | `can_write`, motivo | `FIELD_REVISED` |
| `freeze_dataset` | `can_write`, confirmação literal `CONGELAR` | `DATASET_FROZEN` |
| `transition_case_status` | `can_write` (+ `is_org_admin` para COMPLETED) | `CASE_STATUS_CHANGED` |

Todas são `SECURITY DEFINER` com `search_path = public`, ativam
`fluxa.privileged_op` apenas dentro da própria transação e o desativam ao fim.

## Auditoria não fabricável

`authenticated` não tem `INSERT/UPDATE/DELETE` em `audit_log`, e triggers
`block_delete` recusam update e delete inclusive para papéis privilegiados. A
escrita ocorre por `audit_write_internal` (interna às RPCs) ou pelo cliente admin
no servidor, com `actor_user_id` derivado do token — nunca do payload.

## Advisors executados (2026-08-10)

- **Security advisor:** 11 WARN, todos do mesmo tipo
  `0029_authenticated_security_definer_function_executable` — funções
  `SECURITY DEFINER` executáveis por usuários autenticados. São exatamente as 6
  funções de autorização (`is_org_member`, `has_org_role`, `can_write`,
  `can_review`, `is_org_admin`, `current_org_role`) e as 5 operações oficiais
  acima. **Aceitos por desenho**: cada uma autoriza internamente e existe
  precisamente para que o usuário não precise de privilégio direto na tabela.
  Nenhum ERROR e nenhuma tabela sem RLS.
- **Performance advisor:** foreign keys sem índice foram corrigidas
  (`properties`, `evidence_field_revisions`, `evidence_reviews`, `dataset_items`,
  `ai_runs`). Sem consultas lentas registradas (base ainda pequena).

## Limitações conhecidas (não escondidas)

1. `in_privileged_op()` recebeu `EXECUTE` para `authenticated` (necessário: os
   triggers rodam como o invocador). Ela apenas **lê** um GUC de transação; o GUC
   só é gravado dentro das RPCs `SECURITY DEFINER`. Se algum dia existir uma RPC
   exposta capaz de chamar `set_config('fluxa.privileged_op', ...)`, essa
   proteção cai — revisar em qualquer nova RPC.
2. Não há verificação criptográfica assíncrona periódica dos bytes em storage
   contra `sha256_hash` (detecção de alteração fora do fluxo). Recomendado.
3. Não há assinatura digital externa nem ancoragem de hash em terceiro
   (timestamping). O hash é confiável na medida em que o banco é confiável.
4. Não há rate limiting nem detecção de anomalia sobre a Data API.
5. `profiles` ainda não é populado automaticamente por trigger de novo usuário.
6. Não há procedimento de exclusão/anonimização de titular (LGPD) — conflita com
   a imutabilidade e precisa de decisão de produto.

## Testes negativos

`tests/security/negative-tests.ts` — 49 asserções, execução real contra o banco.
Ver `docs/THREAT_MODEL.md` para o resultado por ameaça.

```
bun run tests/security/negative-tests.ts
```
