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
| market_properties, market_observations, developments | sim | sim | sim (com triggers) | não |
| property_attribute_observations, market_observation_price_history | sim | sim | não | não |
| property_canonical_facts | sim | **não** (só via RPC) | **não** | não |
| comparable_candidates | sim | sim (nasce DISCOVERED/NOT_DECIDED) | **não** (só via RPC) | não |
| comparable_decision_history, comparable_exclusion_reasons | sim | **não** | não | não |
| property_match_candidates | sim | sim | **não** (só via RPC) | não |
| market_source_quality_assessments, derived_values | sim | sim | conforme RLS | não |

`anon` não tem acesso a nenhuma tabela do domínio nem às RPCs oficiais.

## Operações oficiais (única porta de escrita para decisões)

| RPC | Exige | Auditoria transacional |
| --- | --- | --- |
| `verify_evidence_field` | `can_review`, nota técnica, evidência de suporte | `FIELD_VERIFIED` |
| `reject_evidence_field` | `can_review`, motivo | `FIELD_REJECTED` |
| `revise_evidence_field` | `can_write`, motivo | `FIELD_REVISED` |
| `freeze_dataset` | `can_write`, confirmação literal `CONGELAR` | `DATASET_FROZEN` |
| `transition_case_status` | `can_write` (+ `is_org_admin` para COMPLETED) | `CASE_STATUS_CHANGED` |
| `record_price_observation` | `can_write` | `PRICE_OBSERVATION_ADDED` |
| `adopt_canonical_fact` | `can_review`, justificativa, campo de origem `VERIFIED` quando aplicável | `CANONICAL_FACT_ADOPTED` |
| `resolve_property_match` | `can_review`, justificativa para decisões confirmadas | `DUPLICATE_MATCH_CONFIRMED` |
| `decide_comparable` | `can_write`, `ELIGIBLE` prévio para incluir, motivo catalogado para excluir | `COMPARABLE_*` conforme resultado |
| `distance_between_properties_meters` / `distance_subject_to_market_property_meters` | `is_org_member` das duas entidades (leitura) | — |

Todas são `SECURITY DEFINER` com `search_path = public`, ativam
`valuation.privileged_op` apenas dentro da própria transação e o desativam ao
fim (namespace renomeado de `fluxa.*`; ver ADR-019 em `docs/DECISIONS.md`).

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

## Domínio de mercado e comparáveis

`market_observations` e `property_attribute_observations` só recebem
`UPDATE` restrito por trigger (`guard_market_observation_update` impede
reclassificação de tipo e sobrescrita de preço fora de RPC; `property_
attribute_observations` não tem `GRANT` de `UPDATE`, só `SELECT, INSERT`).
`property_canonical_facts`, `comparable_candidates.status` e `property_
match_candidates.match_status` só mudam por RPC — os triggers `guard_
canonical_fact`, `guard_comparable_candidate_update` e `guard_match_
candidate_update` recusam qualquer `UPDATE` fora da operação oficial, mesmo
para OWNER. As RPCs de distância verificam `is_org_member` das duas
entidades antes de retornar qualquer valor, para que o cálculo em si não
vaze a existência/posição de um imóvel de outra organização.

## Limitações conhecidas (não escondidas)

1. `in_privileged_op()` recebeu `EXECUTE` para `authenticated` (necessário: os
   triggers rodam como o invocador). Ela apenas **lê** um GUC de transação; o GUC
   só é gravado dentro das RPCs `SECURITY DEFINER`. Se algum dia existir uma RPC
   exposta capaz de chamar `set_config('valuation.privileged_op', ...)`, essa
   proteção cai — revisar em qualquer nova RPC.
2. Não há verificação criptográfica assíncrona periódica dos bytes em storage
   contra `sha256_hash` (detecção de alteração fora do fluxo). Recomendado.
3. Não há assinatura digital externa nem ancoragem de hash em terceiro
   (timestamping). O hash é confiável na medida em que o banco é confiável.
4. Não há rate limiting nem detecção de anomalia sobre a Data API.
5. `profiles` ainda não é populado automaticamente por trigger de novo usuário.
7. A camada de aplicação (server functions, formulários, rotas) para
   `market_properties`, `market_observations` e `comparable_candidates`
   ainda não existe — apenas o schema, os triggers e as RPCs. Qualquer
   interação hoje seria via chamada direta às RPCs/Data API.
8. Não há geocoding nem regra automática de elegibilidade geográfica de
   comparável (ver `docs/GEO_MODEL.md`).
6. Não há procedimento de exclusão/anonimização de titular (LGPD) — conflita com
   a imutabilidade e precisa de decisão de produto.

## Testes negativos

`tests/security/negative-tests.ts` — 84 asserções negativas, execução real
contra o banco. Ver `docs/THREAT_MODEL.md` para o resultado por ameaça.

`tests/functional/market-flow.ts` — 33 asserções positivas: prova que o caminho
legítimo (avaliando → evidência verificada → imóvel de mercado → observação →
histórico de preço → fato canônico → comparável → duplicidade) continua
operando após o hardening.

```
bun run tests/security/negative-tests.ts
bun run tests/functional/market-flow.ts
```

## RBAC e guardas da camada metodológica (Fase 6)

Operações oficiais (únicas portas, todas `SECURITY DEFINER`, `search_path = public`,
autorização interna explícita, auditoria na mesma transação):
`submit_method_specification`, `approve_method_specification`,
`reject_method_specification`, `verify_methodology_source`,
`resolve_methodology_source_conflict`, `specification_completeness`,
`verify_specification_integrity`, `build_specification_manifest`.

Separação de funções: quem submete não aprova. Aprovação exige `can_review`.

Triggers `SECURITY DEFINER` fail-closed, sem EXECUTE para `PUBLIC`, `anon` ou
`authenticated`: `guard_specification_child`, `guard_rule_source`,
`guard_source_verification`, `guard_methodology_source_artifact`,
`guard_methodology_locator_artifact`, `guard_source_conflict_insert`,
`guard_methodology_parent_immutable`, `guard_method_specification_update`,
`guard_methodology_formula`, `guard_support_check_before_verification`.

Motivo do `SECURITY DEFINER` nas guardas: sob RLS, uma guarda `INVOKER` não
enxerga o registro-pai de outra organização e retornava sem validar — o que
permitia gravação cross-tenant. Agora, pai ausente ou de outra organização
resulta em recusa explícita.

Regressão após o hardening: segurança 84/84, mercado 33/33, pesquisa 28/28,
inteligência de mercado 81/81, governança metodológica 161/161. Linter do banco
sem ERROR; apenas avisos da classe `0029` (RPCs oficiais expostas por desenho a
usuários autenticados, com autorização interna).
