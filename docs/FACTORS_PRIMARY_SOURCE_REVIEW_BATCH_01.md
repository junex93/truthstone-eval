# FACTORS — PRIMARY SOURCE REVIEW, BATCH 01 (T01 / T04 / T07)

Escopo: **T01** (definição/posição metodológica do MCDDM), **T04** (aplicabilidade)
e **T07** (requisitos da amostra), do shell `MCDDM — Tratamento por Fatores`
(`method_specifications` `33333333-0000-4000-8000-000000000001`, status `DRAFT`).

## STATUS DO BATCH 01

**BLOCKED_BY_HUMAN_VERIFICATION.**

Os dois documentos normativos foram enviados e existem no acervo com hash
íntegro. O que falta não é arquivo: falta **verificação humana registrada**
(`METADATA_VERIFIED` → `CONTENT_VERIFIED` → localizador → `LOCATOR_VERIFIED`).
Sem esse gate, nenhuma claim de T01/T04/T07 pode existir — por desenho do banco,
não por escolha de redação.

## A. Artifacts reais auditados

| Item | ABNT NBR 14653-1 | ABNT NBR 14653-2 |
| --- | --- | --- |
| `source_id` | `11111111-0000-4000-8000-000000000002` | `11111111-0000-4000-8000-000000000003` |
| Vínculo fonte-artefato | `7d36f9cf-1407-403d-900a-008bb97fb7eb` | `cc93cd97-40e1-4192-b2f3-6acab1701159` |
| `evidence_artifact_id` | `87439023-2be7-4b55-964e-65b1351adead` | `e763f5cc-082b-47f4-a3bc-d1beba7f193a` |
| Arquivo | `1016407685-ABNT-NBR-14653-1-Procedimentos-Gerais.pdf` | `622822811-NBR-14653-2-2011.pdf` |
| Bytes | 363.398 | 20.774.958 |
| MIME | `application/pdf` | `application/pdf` |
| Bucket | `methodology-sources` (privado) | `methodology-sources` (privado) |
| Base de acesso | `LICENSED_COPY` | `LICENSED_COPY` |
| Captura | `USER_UPLOAD` | `USER_UPLOAD` |
| Organização | `07424a7e-2444-497b-92a4-090def6c0b9b` | idem |
| Registro em | 2026-08-14T19:27:48Z | 2026-08-14T19:27:19Z |

Ambos os arquivos trazem marca d'água de uso exclusivo do licenciado — fato
reportado ao revisor, não removido nem ignorado. A Parte 2 é digitalização de
imagem: leitura exige OCR, e OCR produz apenas candidato.

## B. Integridade (recomputada no servidor nesta rodada)

| Fonte | SHA-256 registrado | SHA-256 recomputado | Resultado |
| --- | --- | --- | --- |
| 14653-1 | `a4c8fa5fac086dd289fa7831b961515c244a538f73b73c6626bf56f2962082d2` | idêntico | **VALID** |
| 14653-2 | `1b8d683a2d6e020cba1c852826850f84f2c86e5f67e04ec21d279bfe073d10a7` | idêntico | **VALID** |

`hash_computed_by = SERVER` nos dois casos; hash de cliente nunca é aceito.

## C. Verificação humana — estado factual

| Fonte | `METADATA_VERIFIED` | `CONTENT_VERIFIED` | `LOCATOR_VERIFIED` |
| --- | --- | --- | --- |
| 14653-1 | ausente | ausente | ausente |
| 14653-2 | ausente | ausente | ausente |

Total de linhas em `methodology_source_verifications` para as duas fontes: **0**.
A organização tem hoje **1 membro ativo (OWNER)**. OWNER satisfaz `can_review`,
portanto a verificação é possível — porém aceitar a própria claim depois exige
revisor **distinto** do proponente, o que hoje não existe no tenant. Essa é uma
pendência operacional declarada, não um bug.

## D. Locators e claims do Batch 01

| Objeto | Contagem para as duas fontes reais |
| --- | --- |
| `methodology_source_locators` | 0 |
| `methodology_source_claims` | 0 |
| `methodology_claim_reviews` | 0 |
| `methodology_claim_rule_assessments` | 0 |

As únicas claims existentes no banco são fixtures `TEST_ONLY` de suíte, em
organizações de teste, e são removidas no cleanup.

### Inventário T01 / T04 / T07

| Tema | `requirement_code` | `is_satisfied` | Motivo registrado |
| --- | --- | --- | --- |
| T01 | `T01_DEFINITION_MCDDM` | `false` | `PENDING_PRIMARY_SOURCE` |
| T04 | `T04_APPLICABILITY` | `false` | `PENDING_PRIMARY_SOURCE` para condições normativas |
| T07 | `T07_SAMPLE_REQUIREMENTS` | `false` | nenhum mínimo amostral pode ser inventado |

Sugestões assistidas de leitura (páginas candidatas) permanecem em
`src/lib/domain/factors-batch01.ts` como **proposta de trabalho para revisor
humano**. Elas não são claim, não satisfazem tema e não entram no banco sozinhas.

## E. Imutabilidade e correção de claim

- `authenticated` não tem `UPDATE` nem `DELETE` em `methodology_source_claims`,
  `methodology_claim_reviews` e `methodology_claim_rule_assessments`; o trigger
  `block_claim_mutation` reforça o comportamento append-only.
- Correção de leitura agora tem linhagem de primeira classe:
  `methodology_source_claims.supersedes_claim_id`, com
  `guard_claim_supersession` impondo que
  1. a antecessora seja da mesma organização, mesma especificação e mesmo tema;
  2. só claim **`REJECTED`** ou **`SUPERSEDED`** por revisor humano possa ser
     substituída;
  3. o vínculo seja imutável após criado, sem autossubstituição nem ciclo direto.
- Consequência: erro de transcrição vira **nova claim ligada à anterior**, nunca
  edição silenciosa; a versão anterior permanece legível no acervo.

## F. Rastreabilidade das regras FAC-*

As regras do shell seguem `INTERNAL_CONTROL` com procedência `INTERNAL_DESIGN`
(fonte de política interna `…00000000000f`) e vínculo `BACKGROUND` com a
NBR 14653-2 apenas como tema correlato — nunca como exigência afirmada.
Nenhum `source_locator_id` está preenchido nesses vínculos, porque não há
localizador verificado.

## G. Ausência de motor de cálculo (verificado)

| Objeto sob a especificação MCDDM | Contagem |
| --- | --- |
| `methodology_formulas` | 0 |
| `methodology_parameters` | 0 |
| `method_applicability_rules` | 5 (critérios declarativos, sem número) |
| `method_implementations` (todo o banco) | 0 |

Especificação MCDDM: **`DRAFT`**. Nenhum fator, faixa numérica, fórmula ou
valor avaliatório foi criado nesta rodada.

## H. Regressão desta rodada

| Suíte | Resultado |
| --- | --- |
| `tests/security/negative-tests.ts` | 84/84 PASS |
| `tests/functional/factors-specification-governance.ts` | 100/100 PASS |
| `tests/functional/methodology-source-ingestion.ts` | 40/40 PASS |
| `tests/functional/methodology-governance-flow.ts` | 161/161 PASS |
| `tests/functional/methodology-claim-gate.ts` | 47/47 PASS |

`methodology-source-ingestion` foi ajustada ao gate da Fase 7E: trecho literal em
localizador só é aceito após `CONTENT_VERIFIED` (novo assert `D0`).

## I. Próximo passo humano (pré-requisito, não opcional)

1. `METADATA_VERIFIED` nas duas fontes, com justificativa.
2. `CONTENT_VERIFIED` nas duas fontes (base de acesso já é `LICENSED_COPY`).
3. Criar localizadores de cláusula para T01, T04 e T07 e verificá-los.
4. Registrar claims candidatas e submetê-las a revisor **distinto** do proponente
   — o que exige um segundo membro com `can_review` na organização.
5. Só então `satisfy_specification_requirement` pode marcar T01/T04/T07.

Batch 02 permanece fechado até o Batch 01 ter claim aceita.

## Fase 7G — Gate de revisor humano independente (2026-08-15)

Estado factual da organização de produção (`Fazenda Albuquerque`) nesta data:

| Fato | Valor |
| --- | --- |
| Membros ativos | 1 |
| OWNER | 1 |
| ADMIN / REVIEWER / VALUER | 0 |
| Revisor independente presente | NÃO |
| `METADATA_VERIFIED` | 0 |
| `CONTENT_VERIFIED` | 0 |
| `LOCATOR_VERIFIED` | 0 |
| Localizadores reais | 0 |
| Claims normativas reais | 0 |
| T01 / T04 / T07 | `PENDING_PRIMARY_SOURCE` |
| Especificação MCDDM | `DRAFT` |
| Fórmulas / parâmetros / implementações operacionais | 0 / 0 / 0 |

**STATUS: `BLOCKED_BY_HUMAN_REVIEWER`.**

Motivo declarado: a organização possui um único membro ativo. A aceitação
profissional de claim exige revisor distinto do proponente, imposto pelo banco em
`review_methodology_claim`. Nenhum revisor fictício, conta de teste, conta de
sistema, `service_role`, fixture ou IA foi criado para satisfazer a segregação —
essa substituição é proibida pela arquitetura.

### O que foi entregue nesta rodada

- `readReviewerSegregationGate` (`src/lib/methodology.server.ts`) e a server
  function de leitura `getReviewerSegregationGate`: diagnóstico factual de
  membros, papéis e presença de revisor independente. Não cria, não convida e não
  eleva papel.
- `src/components/app/ReviewerGate.tsx`: painel humano nas telas de fonte e de
  especificação, com o roster real, o status do lote e a escada de atos
  distintos — `METADATA_VERIFIED` ≠ `CONTENT_VERIFIED` ≠ `LOCATOR_VERIFIED` ≠
  `CLAIM_ACCEPTED` ≠ `METHOD_RULE_APPROVED` ≠ `SPEC_APPROVED`.
- Checkpoint humano do Batch 01 na interface: a proposta assistida de claim
  candidata só é oferecida após metadado **e** conteúdo conferidos na própria
  fonte; antes disso o texto sugerido é declarado material de leitura, nunca
  conteúdo verificado ou requisito normativo.
- Autoria explícita: cada claim exibe quem propôs, quando, e quem revisou com a
  justificativa registrada. Autoria humana nunca é atribuída a IA.

### Próximos atos humanos necessários (nesta ordem)

1. Convidar uma segunda pessoa real com papel `REVIEWER` (não conceder `OWNER`
   para destravar teste).
2. `METADATA_VERIFIED` na NBR 14653-1 e na NBR 14653-2 por humano autorizado.
3. `CONTENT_VERIFIED` nas duas fontes; parar e registrar o checkpoint.
4. Localizadores de T01/T04/T07 conferidos (`LOCATOR_VERIFIED`).
5. Claims candidatas propostas e aceitas por revisor distinto.
6. Só então `satisfy_specification_requirement` para T01/T04/T07 — a
   especificação permanece `DRAFT` de qualquer modo.

## Fase 7H — Tentativa de condução humana do Batch 01 (2026-08-15)

Auditoria factual do tenant de produção (`Fazenda Albuquerque`,
`07424a7e-2444-497b-92a4-090def6c0b9b`) nesta rodada:

| Fato | Valor |
| --- | --- |
| Linhas em `organization_members` (qualquer status) | 1 |
| Membro | `ed3f216b-199f-4931-aeda-dbf4ace8ea3b` · `OWNER` · `ACTIVE` |
| Convites pendentes (`INVITED`/`SUSPENDED`) | 0 |
| REVIEWER / ADMIN / VALUER ativos | 0 |
| `methodology_source_verifications` (org) | 0 |
| `methodology_source_locators` (org) | 0 |
| `methodology_source_claims` / `methodology_claim_reviews` (org) | 0 / 0 |
| T01 / T04 / T07 | `is_satisfied = false` |
| Especificação MCDDM | `DRAFT` |
| Fórmulas / parâmetros / implementações da especificação | 0 / 0 / 0 |

**STATUS: `BLOCKED_BY_HUMAN_REVIEWER`.**

O segundo membro REVIEWER informado não existe no banco: a organização continua
com um único vínculo ativo. Nenhum usuário, papel, verificação, localizador ou
claim foi criado por automação, `service_role`, migração, fixture ou IA para
destravar o fluxo — essa substituição é proibida pela arquitetura e permanece
proibida.

Regressão desta rodada (sem alteração de código de domínio):
`negative-tests` 84/84, `methodology-claim-gate` 47/47,
`methodology-source-ingestion` 40/40, `factors-specification-governance` 100/100,
`methodology-governance-flow` 161/161, `market-intelligence-flow` 81/81,
`market-flow` 33/33, `research-flow` 28/28. Typecheck PASS.
