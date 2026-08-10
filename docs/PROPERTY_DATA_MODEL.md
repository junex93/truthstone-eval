# PROPERTY DATA MODEL

Este documento descreve o modelo real de imóveis introduzido na migração
`20260810200755_b2949fae-5b87-4a5d-b67a-6f1a7faa0ce3.sql` ("Fase 3 — property &
comparable intelligence"). Ver `docs/PRODUCT_CONSTITUTION.md` para as distinções
normativas referenciadas ao longo deste texto e `docs/DATA_GOVERNANCE.md` para a
tabela-resumo de oposições conceituais (PROPERTY != LISTING etc.).

## Três entidades de imóvel, nunca confundidas

| Entidade | Tabela | Papel |
| --- | --- | --- |
| Imóvel avaliando | `properties` | o objeto do laudo/avaliação; único por caso |
| Imóvel de mercado | `market_properties` | um imóvel observado no mercado (comparável em potencial), sempre escopado a um caso |
| Empreendimento | `developments` | o edifício/condomínio/complexo que agrupa unidades (avaliando e/ou mercado) |

`properties` ganhou nesta fase os mesmos atributos físicos e de endereço que
`market_properties` (tipologia, áreas, pavimentos, ocupação, estado de
conservação, endereço estruturado, `geo_point`), para que o mesmo vocabulário
de atributos (`src/lib/domain/constants.ts`) descreva o avaliando e o mercado
sem duplicar semântica.

`market_properties.id` e `properties.id` são conceitos distintos: um
`market_property` **não é** um imóvel avaliando e nunca é promovido a um sem
decisão humana explícita (não há RPC de "promoção" nesta fase — não
implementado).

`PROPERTY != LISTING`: `market_properties` é o imóvel físico; um anúncio (uma
`REAL_ESTATE_LISTING`) é registrado como `market_observations`, nunca como
linha própria em `market_properties`. Um mesmo imóvel de mercado pode ter
várias observações (anúncios, cotações, transações) ao longo do tempo — ver
`docs/MARKET_OBSERVATION_MODEL.md`.

## Empreendimento (`developments`)

Escopado por caso (`organization_id, valuation_case_id`). `properties` e
`market_properties` podem referenciar `development_id` por FK composta
`(organization_id, valuation_case_id, development_id)`, garantindo que uma
unidade nunca aponte para um empreendimento de outro caso.

## Atributo observado vs. fato canônico

Dois níveis, nunca colapsados em um só:

1. **`property_attribute_observations`** — o que uma evidência específica
   afirma sobre um atributo de um imóvel (avaliando OU de mercado, nunca
   ambos: `attr_obs_exactly_one_entity_chk`). Múltiplas observações do mesmo
   atributo, inclusive divergentes entre si, coexistem: nada é sobrescrito ou
   reconciliado automaticamente. Cada observação carrega:
   - `raw_value` / `normalized_value` / `numeric_value` / `unit`;
   - `knowledge_state` (`KNOWN`, `UNKNOWN`, `NOT_APPLICABLE`, `CONFLICTING`,
     `PENDING_VERIFICATION`);
   - `value_origin` (`MANUAL_USER_INPUT`, `EVIDENCE_EXTRACTION`,
     `EXTERNAL_API`, `DETERMINISTIC_DERIVATION`, `FIELD_INSPECTION`);
   - vínculo opcional com `evidence_field_id` / `evidence_source_id`.
   A tabela é append-only: `trg_pao_nodelete` e `trg_pao_noupdate` bloqueiam
   `DELETE` e `UPDATE` diretos.

2. **`property_canonical_facts`** — o valor **adotado** pelo profissional para
   o atributo, para aquele caso. Só é escrito pela RPC `adopt_canonical_fact`
   (trigger `guard_canonical_fact` recusa qualquer `INSERT`/`UPDATE` fora da
   operação oficial). Regras impostas pela RPC:
   - exige `can_review` (REVIEWER, ADMIN ou OWNER) e justificativa registrada
     (mínimo 3 caracteres);
   - a observação de origem precisa pertencer exatamente à entidade informada
     (avaliando OU imóvel de mercado);
   - valor de `value_origin = EXTERNAL_API` nunca pode ser adotado como fato;
   - valor de `value_origin = EVIDENCE_EXTRACTION` só pode ser adotado se o
     `evidence_field_id` vinculado estiver `VERIFIED` — saída de IA/parser sem
     verificação humana não vira fato canônico;
   - adoção nova **supera** (`superseded_at`, `superseded_by_fact_id`) a
     anterior para o mesmo atributo/entidade — nunca a apaga (append-only por
     superação, não por edição).

Um fato adotado é **ADOPTED != UNIVERSALLY TRUE**: é o valor que o avaliador
escolheu usar naquele caso, com justificativa auditável, não uma verdade
absoluta sobre o imóvel. Observações divergentes continuam visíveis mesmo após
a adoção.

## `UNKNOWN != ZERO`

`knowledge_state = 'UNKNOWN'` é o estado explícito para "não se sabe". Um
campo numérico ausente nunca é gravado como `0`; a ausência de conhecimento é
modelada como estado, não como valor numérico neutro. O mesmo enum cobre
`NOT_APPLICABLE` (o atributo não se aplica a esse tipo de imóvel) e
`CONFLICTING` (fontes divergem sem que haja ainda decisão de adoção), estados
distintos entre si e distintos de "zero" ou "nulo silencioso".

## Normalização de endereço

`address_normalization_status` (`NOT_ATTEMPTED`, `CANDIDATE`, `VERIFIED`,
`AMBIGUOUS`, `FAILED`) é uma classificação de estado do processo de
normalização — não um score. Não há, nesta fase, nenhum serviço de geocoding
integrado: o preenchimento de `address_normalized`, `geo_point`,
`latitude`/`longitude` é manual ou vindo de evidência, e o status permanece
`NOT_ATTEMPTED` por padrão em todas as tabelas que o carregam (`properties`,
`market_properties`, `developments`). Ver `docs/GEO_MODEL.md`.

## Imutabilidade de `organization_id`

`properties` já possuía `prevent_org_migration` (fase anterior). Nesta fase,
o mesmo trigger foi estendido a `developments`, `market_properties`,
`market_observations`, `comparable_candidates` e
`market_source_quality_assessments`: nenhuma linha de domínio de imóvel ou
mercado pode trocar de organização depois de criada. A integridade de tenant
é reforçada por FK composta `(organization_id, id)` em todas essas tabelas
(ex.: `properties_org_id_uniq`, `market_properties_org_id_uniq`), de modo que
um filho nunca referencia um pai de outra organização mesmo por erro de
aplicação.

## O que não existe nesta fase (não implementado por omissão deliberada)

- Não há biblioteca de imóveis de mercado entre casos: `market_properties` é
  sempre escopado a `valuation_case_id`. Reuso entre casos não é suportado.
- Não há promoção automática ou manual de `market_property` para `property`.
- Não há geocoding automático (ver `docs/GEO_MODEL.md`).
- Não há score de completude ou confiança calculado sobre atributos —
  `COMPLETENESS != CONFIDENCE`, e nenhuma das duas é calculada aqui.
