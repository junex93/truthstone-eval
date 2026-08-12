# THREAT MODEL

Atacante considerado: **usuário autenticado legítimo** com token válido, chave
publicável e capacidade de chamar a Data API, o Storage e as RPCs diretamente,
ignorando totalmente a interface. Também consideramos um visitante anônimo e um
membro de outra organização.

Resultado de execução real: `bun run tests/security/negative-tests.ts` —
**84 asserções, 84 aprovadas, 0 falhas** (2026-08-11).

Contraprova de que o hardening não bloqueou o uso legítimo:
`bun run tests/functional/market-flow.ts` — **33 asserções, 33 aprovadas,
0 falhas** (2026-08-11).

## T1 — Visitante anônimo lê o acervo

Mitigação: `anon` sem GRANT em nenhuma tabela de domínio nem nas RPCs.
Testes: leitura de `valuation_cases` e `evidence_fields` e chamada de
`verify_evidence_field` → `permission denied`.

## T2 — Vazamento entre organizações

Mitigação: RLS por `is_org_member`, FKs compostas `(organization_id, id)`,
`organization_id` imutável.
Testes: leitura de casos/fontes de outra org → 0 linhas; criação de caso em outra
org → violação de RLS; verificação de campo de outra org → recusa por papel.

## T3 — Auto-verificação de evidência por quem produziu o dado

Mitigação: `can_review` na RPC; ausência de GRANT de UPDATE em `evidence_fields`.
Testes: VALUER via RPC → recusado; VALUER via UPDATE direto → `permission denied`;
OWNER via UPDATE direto → `permission denied` (mesmo com poder, o caminho não
oficial não existe); verificação sem nota técnica → recusada; campo inserido já
`VERIFIED` → recusado.

## T4 — Fabricação de trilha de auditoria

Mitigação: sem GRANT de escrita em `audit_log`, `evidence_reviews` e
`evidence_field_revisions`; `block_delete` em update/delete.
Testes: insert, update e delete em `audit_log` → `permission denied`; forjar
revisão e forjar decisão de revisão → `permission denied`.
Verificação positiva: após operações oficiais, `audit_log` contém
`FIELD_VERIFIED` e `DATASET_FROZEN` — auditoria na mesma transação.

## T5 — Alteração da prova bruta

Mitigação: `protect_artifact_immutability`, `block_delete`, sem GRANT de UPDATE.
Testes: reescrever `sha256_hash` → `permission denied`; delete do artefato → sem
efeito persistido (estado reconferido intacto).

## T6 — Pulo de fase / mudança silenciosa de status

Mitigação: `guard_case_status` + RPC `transition_case_status`.
Testes: `UPDATE status` direto → recusado; `EVIDENCE_COLLECTION → COMPLETED` →
transição inválida; arquivamento sem justificativa → recusado.

## T7 — Dataset "congelado" que muda depois

Mitigação: snapshots imutáveis + `protect_frozen_dataset` +
`protect_frozen_dataset_items`.
Testes: escrever `frozen_at`/`dataset_hash` direto → `permission denied`;
congelar dataset vazio → recusado; congelar sem confirmação `CONGELAR` →
recusado; após freeze: editar metadados, incluir item, remover item, atualizar ou
apagar snapshot, revisar ou rejeitar campo congelado → todos recusados; apagar a
versão de dataset → sem efeito.
Verificação positiva: freeze retorna `dataset_hash` SHA-256 e grava snapshot com
valores (não apenas referência).

## T8 — Contaminação cross-case no dataset

Mitigação: `protect_frozen_dataset_items` compara o caso da evidência com o caso
do dataset.
Teste: campo VERIFIED do caso A2 em dataset do caso A1 → "Contaminação cross-case
bloqueada".

## T9 — Edição silenciosa de campo verificado

Mitigação: sem GRANT de UPDATE; `guard_evidence_field_update` exige
`revise_evidence_field`, que **invalida** a verificação.
Testes: `UPDATE raw_value` em campo VERIFIED → `permission denied`; revisão sem
motivo → recusada.

## T10 — Escalação de privilégio

Mitigação: papel em tabela separada; `guard_membership_changes`; RLS de
`organization_members`.
Testes: VALUER promovendo a si mesmo a OWNER → sem efeito (papel reconferido
como VALUER); VALUER convidando ADMIN → violação de RLS; rebaixar o último OWNER
→ recusado.

## T11 — Upload fora do escopo / leitura de prova alheia

Mitigação: policies de storage validam `organization_id` e `valuation_case_id` do
path contra o banco; buckets privados.
Testes: upload no path de outra org → violação de RLS; upload em caso
inexistente → violação de RLS; download de objeto de outra org → não encontrado.

## T12 — Hash calculado pelo cliente

Mitigação: `registerEvidenceArtifact` baixa os bytes do bucket e calcula SHA-256
no servidor; `hash_computed_by = 'SERVER'`; artefato só é inserido pelo cliente
admin no servidor (sem GRANT de INSERT para `authenticated`).

## Ameaças reconhecidas e ainda NÃO mitigadas

- **T13** Comprometimento da service role key ou do próprio banco: derruba todas
  as garantias. Não há ancoragem externa de hash (timestamping/notarização).
- **T14** Alteração de bytes no storage fora do fluxo: não há job periódico de
  reconciliação hash-vs-bytes.
- **T15** Exfiltração em massa por membro legítimo (leitura é permitida por
  papel): não há rate limiting nem detecção de anomalia.
- **T16** Colusão entre OWNER e REVIEWER: mitigada apenas por rastreabilidade
  (autor + justificativa + timestamp), não por prevenção.
- **T17** Confiança no `valuation.privileged_op` (GUC, renomeado de
  `fluxa.privileged_op` — ver ADR-019): ver limitação 1 em `docs/SECURITY.md`.

## T18 — Contaminação cross-case no domínio de mercado

Mitigação: `guard_market_evidence_scope` compara o caso da evidência
vinculada com o caso da observação/observação de atributo antes de aceitar
`INSERT`/`UPDATE`; FKs compostas `(organization_id, valuation_case_id, id)`
em `market_properties`, `market_observations`, `comparable_candidates` e
`property_match_candidates` impedem referenciar entidade de outro caso.
Situação análoga a T8, aplicada ao novo domínio.
Ainda **não coberto** por teste negativo executável (ver limitação abaixo).

## T19 — Sobrescrita silenciosa de preço pedido

Mitigação: `guard_market_observation_update` recusa `UPDATE` direto de
`asking_price`/`asking_monthly_rent` fora de operação privilegiada; a única
porta é `record_price_observation`, que insere uma linha em `market_
observation_price_history` (append-only, sem GRANT de UPDATE/DELETE) antes
de atualizar o valor corrente.
Teste: não coberto por `tests/security/negative-tests.ts` nesta fase (ver
limitação abaixo).

## T20 — Adoção não autorizada de fato canônico

Mitigação: `guard_canonical_fact` recusa qualquer escrita em `property_
canonical_facts` fora de `adopt_canonical_fact`; a RPC exige `can_review`,
justificativa registrada e, para observações de extração, o campo de
evidência subjacente `VERIFIED`. Origem `EXTERNAL_API` nunca é adotável.
Teste: não coberto por teste negativo executável nesta fase.

## T21 — Forjar decisão de comparável ou de duplicidade

Mitigação: `guard_comparable_candidate_update` e `guard_match_candidate_
update` recusam `UPDATE` direto em `comparable_candidates` e `property_
match_candidates`; as únicas portas são `decide_comparable` (exige
`ELIGIBLE` prévio para incluir, motivo catalogado para excluir) e `resolve_
property_match` (exige `can_review` e justificativa para confirmações).
`comparable_decision_history` é append-only e não fabricável por INSERT
direto (sem GRANT).
Teste: não coberto por teste negativo executável nesta fase.

## Ameaças novas reconhecidas e ainda NÃO cobertas por teste executável

T18–T21 acima têm mitigação estrutural no banco (trigger + RPC + ausência de
GRANT), mas, diferentemente de T1–T12, **não** têm hoje uma asserção
correspondente em `tests/security/negative-tests.ts`. A extensão da suíte de
testes negativos para cobrir o domínio de mercado e comparáveis é
recomendada e ainda não foi feita — declarado aqui, não escondido.

## Ameaças da camada metodológica (M01–M14)

| ID | Ameaça | Mitigação imposta no banco |
| --- | --- | --- |
| M01 | Auto-aprovação da própria especificação | `approve_method_specification` compara aprovador e submissor |
| M02 | Aprovação por papel sem autoridade | `can_review` verificado dentro da RPC |
| M03 | Edição de especificação aprovada | `guard_method_specification_update` (imutabilidade) |
| M04 | Alteração direta de status/hash pelo cliente | GRANT sem UPDATE nas colunas de decisão; só RPC |
| M05 | Injeção de código executável em fórmula | `guard_methodology_formula` recusa expressão executável |
| M06 | Regra normativa sem fundamento | completude bloqueia submissão sem localizador verificado |
| M07 | Citação literal de norma paga | `METADATA_ONLY` recusa `CONTENT_VERIFIED` |
| M08 | Gravação cross-tenant de conteúdo metodológico | guardas `SECURITY DEFINER` fail-closed |
| M09 | Vínculo a artefato de outra organização | `guard_methodology_source_artifact` / `_locator_artifact` |
| M10 | Migração de organização ou troca de pai | `guard_methodology_parent_immutable`, `prevent_org_migration` |
| M11 | Resolução automática de conflito entre fontes | resolução só por RPC com fundamento humano |
| M12 | Falsificação da trilha de auditoria | sem GRANT de escrita em `audit_log`; autor vem do token |
| M13 | Operação sem evento de auditoria correspondente | evento gravado na mesma transação da RPC |
| M14 | IA criando ou aprovando norma/metodologia | nenhuma escrita de IA nas tabelas de metodologia |
