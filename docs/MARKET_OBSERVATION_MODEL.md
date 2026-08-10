# MARKET OBSERVATION MODEL

Descreve `market_observations`, `market_observation_price_history` e as
regras de imutabilidade e provenança impostas em
`20260810200755_b2949fae-5b87-4a5d-b67a-6f1a7faa0ce3.sql`. Ver
`docs/PROPERTY_DATA_MODEL.md` para a distinção entre `market_properties` (o
imóvel) e observações (o que se sabe sobre ele em um dado momento).

## O que é uma observação de mercado

`market_observations` registra uma ocorrência de mercado sobre um
`market_property`: um anúncio, uma cotação de corretor, uma referência de
avaliação ou uma transação concretizada. Tipos (`market_observation_type`):

- `SALE_LISTING`, `RENT_LISTING`, `BROKER_QUOTE`, `APPRAISAL_REFERENCE`,
  `OTHER` — carregam **preço pedido** (asking);
- `CLOSED_SALE`, `CLOSED_RENT` — carregam **preço transacionado**
  (transaction).

Um `market_observation` não é o imóvel; é um evento/registro sobre ele. Um
mesmo `market_property` pode acumular várias observações ao longo do tempo
(vários anúncios, cotações e, eventualmente, uma transação).

## `ASKING != TRANSACTION`

A separação é estrutural, não apenas semântica. As colunas coexistem na
mesma tabela mas são mutuamente exclusivas por `CHECK` constraint:

- `asking_price`, `asking_monthly_rent` — só podem ser não-nulas quando
  `observation_type IN ('SALE_LISTING','RENT_LISTING','BROKER_QUOTE',
  'APPRAISAL_REFERENCE','OTHER')` (`market_observations_asking_scope_chk`);
- `transaction_price`, `transaction_date`, `transaction_evidence_status`,
  `contracted_monthly_rent` — só podem ser não-nulas quando
  `observation_type IN ('CLOSED_SALE','CLOSED_RENT')`
  (`market_observations_transaction_scope_chk`).

Não existe conversão implícita de um valor pedido em valor transacionado: o
sistema nunca infere que uma oferta "virou" venda. Isso exige uma observação
distinta do tipo `CLOSED_SALE`/`CLOSED_RENT`, com sua própria evidência.

## `observation_type` é imutável

`guard_market_observation_update` recusa qualquer `UPDATE` que altere
`observation_type` depois de criado: uma oferta jamais é reclassificada em
transação por edição. Registrar uma venda concretizada exige criar uma nova
observação do tipo `CLOSED_SALE`. O mesmo trigger também recusa a troca de
`market_property_id` ou `valuation_case_id` de uma observação já existente.

## Status da observação: `REMOVED != SOLD`

`market_observation_status`: `ACTIVE`, `INACTIVE`, `REMOVED`, `EXPIRED`,
`UNKNOWN`. Deliberadamente **não existe** um status `SOLD`. Um anúncio que
sai do ar (`REMOVED`) não é evidência de venda: pode ter sido retirado por
qualquer motivo (desistência, erro, renegociação fora do mercado, etc.). A
única forma de registrar uma venda é uma observação `CLOSED_SALE`/
`CLOSED_RENT` com sua própria evidência — nunca uma inferência a partir do
desaparecimento de um anúncio.

## `transaction_evidence_status`: proveniência, não confiança

`DOCUMENTED`, `MULTI_SOURCE_CONFIRMED`, `DECLARED`, `UNVERIFIED` classificam
**a origem** da informação de transação (documento registral, múltiplas
fontes confirmando, declaração de parte, ou não verificada) — não um grau de
precisão ou uma pontuação de confiança. `COMPLETENESS != CONFIDENCE`: esta
classificação não é combinada com nenhuma outra métrica.

## Histórico de preço é append-only

`market_observation_price_history` guarda cada preço pedido observado ao
longo do tempo para uma mesma `market_observation` (`asking_price`,
`asking_monthly_rent`, `observation_status`, `observed_at`, evidência de
origem). A tabela tem `GRANT` apenas de `SELECT, INSERT` para
`authenticated`; `trg_mph_nodelete` e `trg_mph_noupdate` bloqueiam qualquer
alteração ou remoção de um registro histórico já gravado.

### `record_price_observation` — única porta de escrita de preço

Alterar `asking_price`/`asking_monthly_rent` de uma observação por `UPDATE`
direto é recusado por `guard_market_observation_update` a menos que a
operação esteja marcada como privilegiada — o que só ocorre dentro da RPC
`record_price_observation`. Essa RPC, em uma única transação:

1. exige `can_write` na organização;
2. insere a nova leitura em `market_observation_price_history` (preservando a
   leitura anterior, nunca sobrescrevendo-a);
3. atualiza os campos correntes de `market_observations` (preço pedido atual,
   status, `last_seen_at`);
4. grava auditoria `PRICE_OBSERVATION_ADDED` na mesma transação.

Não existe caminho no schema para sobrescrever silenciosamente um preço
pedido histórico: qualquer nova leitura de preço passa por essa RPC e deixa
rastro append-only.

## Vínculo com evidência

`market_observations` referencia opcionalmente `evidence_source_id` e
`primary_artifact_id` (FK composta por organização). `market_observation_
price_history` e `property_attribute_observations` podem referenciar
`evidence_source_id`/`evidence_field_id`. O trigger `guard_market_evidence_
scope` impede que a fonte de evidência vinculada pertença a um caso de
avaliação diferente do da observação — a mesma proteção anti-contaminação
cross-case do modelo de evidência (`docs/DATASET_INTEGRITY.md`) é aplicada
aqui.

## O que não existe nesta fase

- Não há inferência de venda a partir de retirada de anúncio.
- Não há normalização automática de moeda (apenas `currency_code` de 3 letras
  validado por formato).
- Não há score de confiança sobre observações ou preços.
