# GEO MODEL

Descreve o modelo geográfico introduzido em
`20260810200755_b2949fae-5b87-4a5d-b67a-6f1a7faa0ce3.sql` com a extensão
`postgis`. Aplica-se a `properties`, `market_properties` e `developments`.

## `geo_point` é a posição canônica

Cada uma das três tabelas ganhou uma coluna `geo_point
extensions.geography(Point, 4326)`. Esta é a **posição geográfica
canônica**. As colunas `latitude`/`longitude` (numéricas) existem apenas por
interoperabilidade (exportação, exibição, integrações externas) e nunca são
uma segunda fonte de verdade independente.

## Sincronização por trigger — divergência é impossível

A função `sync_geo_point()` (trigger `BEFORE INSERT OR UPDATE`, instalada
como `trg_properties_geo`, `trg_market_properties_geo` e
`trg_developments_geo`) impõe consistência em toda escrita:

- se `latitude` e `longitude` forem informados, `geo_point` é recalculado a
  partir deles (`ST_MakePoint` + `ST_SetSRID(..., 4326)`);
- caso contrário, se `geo_point` for informado diretamente, `latitude` e
  `longitude` são derivados dele (`ST_Y`/`ST_X`);
- se nenhum dos dois for informado, `geo_point` é limpo (`NULL`).

Não existe caminho de escrita em que `geo_point` e `latitude`/`longitude`
fiquem inconsistentes entre si: o trigger sempre recalcula um a partir do
outro na mesma transação de gravação, e roda como o papel invocador (não é
`SECURITY DEFINER`), então se aplica a qualquer `INSERT`/`UPDATE` permitido
por RLS.

## Índices espaciais

GiST criado para as três tabelas:

- `idx_properties_geo` em `properties(geo_point)`;
- `idx_mp_geo` em `market_properties(geo_point)`;
- `idx_dev_geo` em `developments(geo_point)`.

Esses índices existem para consultas de proximidade eficientes; não impõem
nenhuma regra de negócio por si sós.

## RPCs de distância

Duas funções `STABLE SECURITY DEFINER`, ambas apenas leitura:

- `distance_between_properties_meters(_left_market_property_id, _right_market_property_id)`
  — distância, em metros, entre dois `market_properties`;
- `distance_subject_to_market_property_meters(_subject_property_id, _market_property_id)`
  — distância entre o imóvel avaliando e um imóvel de mercado.

Ambas usam `ST_Distance` sobre `geography` (distância geodésica, não
euclidiana no plano), arredondada a 2 casas decimais. Se qualquer um dos dois
pontos for `NULL` (posição desconhecida), a função retorna `NULL` — nunca
uma distância inventada ou zero.

### Checagem de pertencimento organizacional

Antes de calcular a distância, cada RPC resolve `organization_id` das duas
entidades e exige `is_org_member(org)` para ambas — se o usuário não for
membro da organização de qualquer um dos dois lados, a função levanta
exceção ("Acesso negado a imóvel fora da organização") em vez de retornar um
número. Isso impede que a Data API ou um cliente autenticado descubra a
posição de um imóvel de outra organização através do cálculo de distância,
mesmo que o resultado numérico por si só pareça inofensivo.

`REVOKE ALL ... FROM anon` e `GRANT EXECUTE ... TO authenticated` em ambas:
`anon` não pode invocar nenhuma das duas funções.

## O que não existe nesta fase

- **Não há geocoding**: nenhuma integração converte endereço em coordenadas
  automaticamente. O preenchimento de `latitude`/`longitude`/`geo_point` é
  manual ou vem de evidência informada pelo usuário. O `address_
  normalization_status` (ver `docs/PROPERTY_DATA_MODEL.md`) descreve o estado
  do texto do endereço, não implica em geocodificação.
- **Não há regra de raio ou elegibilidade geográfica**: distância é dado
  factual (metros entre dois pontos), nunca um critério automático de
  inclusão/exclusão de comparável. A decisão de elegibilidade continua
  exclusivamente humana, via `decide_comparable`
  (`docs/COMPARABLE_GOVERNANCE.md`).
- Não há cálculo de área de influência, isócronas ou qualquer derivação
  espacial além da distância ponto-a-ponto.
