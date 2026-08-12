# FACTORS — PRIMARY SOURCE REVIEW, BATCH 01 (T01 / T04 / T07)

Escopo exclusivo desta rodada: **T01** (definição/posição metodológica do MCDDM e
do Tratamento por Fatores), **T04** (aplicabilidade) e **T07** (requisitos da
amostra), do shell `MCDDM — Tratamento por Fatores`
(`method_specifications` `33333333-0000-4000-8000-000000000001`, status `DRAFT`).

## STATUS

**BLOCKED_BY_USER_ARTIFACT.**

Nenhuma extração de conteúdo normativo foi feita. Nenhuma regra real da
especificação foi alterada. Nenhuma seção foi preenchida com conteúdo externo.

## Source gate — estado auditado

| Item | ABNT NBR 14653-1 | ABNT NBR 14653-2 |
| --- | --- | --- |
| `source_id` | `11111111-0000-4000-8000-000000000002` | `11111111-0000-4000-8000-000000000003` |
| Artefato autorizado vinculado | **não** (0 em `methodology_source_artifacts`) | **não** (0) |
| Base de acesso (`access_status`) | `METADATA_ONLY` | `METADATA_ONLY` |
| SHA-256 do artefato | inexistente (sem bytes no acervo) | inexistente |
| Verificação de metadados | pendente | pendente |
| Verificação de conteúdo | **não** — bloqueada por desenho em `METADATA_ONLY` | **não** |
| Capacidade de localizador | nenhuma (localizador exige artefato da mesma fonte) | nenhuma |
| Escopo organizacional | global (`organization_id = NULL`, somente leitura ao tenant) | global |

Consequência: o gate
`ARTIFACT → CONTENT_VERIFIED → LOCATOR → LOCATOR_VERIFIED → RULE CANDIDATE`
não pode ser iniciado. Reconstruir conteúdo por memória do modelo, internet ou
literatura secundária é proibido (`docs/METHODOLOGY_SOURCE_GOVERNANCE.md`).

## T01 / T04 / T07 — achados

Nenhuma claim foi criada. Não existe `claim_id`, `artifact_id`, `locator_id` nem
`support status` a reportar, porque não há fonte com conteúdo verificado.

| Tópico | Requisito no topic map | Estado |
| --- | --- | --- |
| T01 | `T01_DEFINITION_MCDDM` | `is_satisfied = false`, `PENDING_PRIMARY_SOURCE` |
| T04 | `T04_APPLICABILITY` | `is_satisfied = false`, `PENDING_PRIMARY_SOURCE` |
| T07 | `T07_SAMPLE_REQUIREMENTS` | `is_satisfied = false`, nenhum mínimo amostral admissível |

## Regras candidatas relacionadas

As regras `CANDIDATE_INTERPRETATION` correlacionadas a T01/T04/T07
(FAC-A01, FAC-A02, FAC-A03, FAC-A04 e, por tema de amostra, FAC-I02/FAC-I03)
permanecem **KEEP CANDIDATE**: `normative_strength = INTERNAL_CONTROL`,
procedência `INTERNAL_DESIGN`, vínculo `BACKGROUND` com a norma. Reclassificar
para `INTERPRETATION` de claim externa exigiria a claim externa — que não existe.

Regras `INTERNAL_CONTROL` de plataforma (hash, provenance, ausência declarada)
seguem internas e não foram fundidas com requisito de fonte.

## Conflitos de fonte

Nenhum. `methodology_source_conflicts` global permanece vazio: sem duas fontes
com conteúdo verificado, conflito material não é afirmável.

## Questões abertas

1. Aquisição autorizada do texto da NBR 14653-1 e 14653-2, com base de acesso
   registrada e artefato carregado no bucket privado `methodology-sources`.
2. `CONTENT_VERIFIED` por revisor humano (`can_review`), com justificativa.
3. Localizadores de cláusula para T01, T04 e T07 + `LOCATOR_VERIFIED`.
4. T04: tradução de eventual claim externa em regra computacional só depois da
   claim — nunca antes, e sempre como `INTERPRETATION` separada.
5. T07: quantidade amostral permanece proibida até haver fonte + localizador.

## Mapeamento à Fase 5 (preparado, não aplicado)

Quando T07 tiver claim verificada, o alvo de mapeamento já existente é:
Market Evidence Snapshot, imóveis físicos independentes, evidência verificada,
diagnóstico de fonte/temporal/espacial, cobertura de atributos, seleção amostral
e prontidão. Nenhum dado da Fase 5 foi alterado nesta rodada.

## Próximo batch recomendado

Repetir o Batch 01 (T01/T04/T07) assim que houver artefato autorizado. Sem isso,
avançar para T02/T03/T05 é igualmente bloqueado.
