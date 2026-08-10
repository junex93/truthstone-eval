# COMPARABLE GOVERNANCE

Descreve o ciclo de vida de candidatos a comparável
(`comparable_candidates`), a taxonomia de exclusão
(`comparable_exclusion_reasons`), a única porta de decisão (`decide_
comparable`), o histórico append-only (`comparable_decision_history`) e a
revisão de duplicidade entre imóveis de mercado (`property_match_candidates`,
`resolve_property_match`). Fonte: `20260810200755_...sql`.

## Dois eixos de estado, independentes

Um candidato a comparável tem dois campos de estado que não se confundem:

| Campo | Enum | Significado |
| --- | --- | --- |
| `candidate_status` | `DISCOVERED`, `UNDER_REVIEW`, `ELIGIBLE`, `INELIGIBLE` | a triagem técnica: o candidato atende aos critérios de elegibilidade? |
| `inclusion_status` | `NOT_DECIDED`, `INCLUDED`, `EXCLUDED` | a decisão do avaliador: este comparável entra na análise? |

`DISCOVERED != ELIGIBLE`: ser localizado não significa ter passado por
triagem. `ELIGIBLE != INCLUDED`: ser elegível não significa ter sido
escolhido — a inclusão é uma decisão adicional, distinta da elegibilidade
técnica. A RPC `decide_comparable` impõe essa ordem: `INCLUDED` só é aceito
se o `candidate_status` (informado na mesma chamada ou já vigente) for
`ELIGIBLE`.

Um candidato nasce sempre `DISCOVERED` / `NOT_DECIDED`: a policy `cc_insert`
recusa `INSERT` com qualquer outro par de valores.

## `decide_comparable` — única porta de decisão

`guard_comparable_candidate_update` recusa qualquer `UPDATE` direto em
`comparable_candidates` fora de uma operação marcada como privilegiada — ou
seja, fora da RPC `decide_comparable`. A RPC, em transação única:

1. exige `can_write` na organização;
2. se a inclusão pedida é `INCLUDED`, exige que o `candidate_status`
   resultante seja `ELIGIBLE`;
3. se a inclusão pedida é `EXCLUDED`, exige um `exclusion_reason_code` válido
   e ativo na taxonomia (`comparable_exclusion_reasons`) — exclusão sem
   motivo catalogado é recusada;
4. atualiza `candidate_status`/`inclusion_status`/motivo/notas e grava
   `reviewed_by`/`reviewed_at`;
5. insere uma linha em `comparable_decision_history` com o estado anterior e
   o novo estado, motivo, notas e `actor_user_id`;
6. grava evento de auditoria (`COMPARABLE_DISCOVERED`,
   `COMPARABLE_MARKED_ELIGIBLE`, `COMPARABLE_MARKED_INELIGIBLE`,
   `COMPARABLE_INCLUDED` ou `COMPARABLE_EXCLUDED`, conforme o resultado).

## Taxonomia de motivos de exclusão

Tabela `comparable_exclusion_reasons` (código, rótulo, versão de taxonomia,
`is_active`), com leitura pública para `authenticated`. Motivos seed:

| Código | Rótulo |
| --- | --- |
| `WRONG_PROPERTY_TYPE` | Tipologia incompatível |
| `LOCATION_OUT_OF_SCOPE` | Localização fora do escopo |
| `AREA_OUT_OF_SCOPE` | Área fora do escopo |
| `AGE_OUT_OF_SCOPE` | Idade fora do escopo |
| `CONDITION_INCOMPATIBLE` | Estado de conservação incompatível |
| `INSUFFICIENT_DATA` | Dados insuficientes |
| `DUPLICATE` | Duplicidade |
| `STALE_OBSERVATION` | Observação desatualizada |
| `PRICE_NOT_VERIFIABLE` | Preço não verificável |
| `ADDRESS_AMBIGUOUS` | Endereço ambíguo |
| `TRANSACTION_NOT_VERIFIABLE` | Transação não verificável |
| `OTHER` | Outro |

A taxonomia é classificatória: nenhum código carrega peso, penalidade ou
score. Novos motivos são adicionados por migração (`taxonomy_version`), nunca
editados em linha por aplicação.

## `EXCLUDED != DELETED`

Não existe `DELETE` de `comparable_candidates` (`trg_cc_nodelete`) nem de
`comparable_decision_history` (`trg_cdh_nodelete`, além de
`trg_cdh_noupdate` bloqueando também `UPDATE`). Um comparável excluído
permanece na base, com seu motivo e todo o seu histórico de decisão visível
— "excluir da análise" nunca significa "apagar do sistema".

## Histórico de decisão é append-only

`comparable_decision_history` só recebe `INSERT` (via `decide_comparable`);
não há `GRANT` de `INSERT`/`UPDATE`/`DELETE` direto para `authenticated` além
de `SELECT` — a escrita ocorre exclusivamente dentro da RPC `SECURITY
DEFINER`. Cada linha guarda o par completo (status anterior/novo de
candidatura e de inclusão), preservando a trajetória integral de cada
candidato, decisão a decisão.

## Revisão de duplicidade entre imóveis de mercado

`property_match_candidates` registra pares de `market_properties` do mesmo
caso, potencialmente o mesmo imóvel físico anunciado mais de uma vez:

- `left_market_property_id < right_market_property_id` é imposto por
  `CHECK` (par ordenado, sem duplicar o mesmo par em ordem invertida);
- `reason_codes` (texto) e `deterministic_signals` (jsonb) guardam apenas
  **sinais determinísticos** (`MATCH_REASON_CODES`: mesmo endereço
  normalizado, mesmo empreendimento, mesmo identificador de unidade, mesma
  área, mesmo pavimento, mesmo ID de anúncio externo, mesma referência de
  corretor, mesmo hash de telefone, mesmo hash de imagem, outro). **Não há
  probabilidade, percentual ou score de similaridade** em nenhum campo desta
  tabela;
- `match_status`: `CANDIDATE`, `CONFIRMED_SAME`, `CONFIRMED_DIFFERENT`,
  `UNRESOLVED`.

### `resolve_property_match` — única porta de decisão de duplicidade

`guard_match_candidate_update` recusa `UPDATE` direto; a decisão só ocorre
via `resolve_property_match`, que exige `can_review` e, para
`CONFIRMED_SAME`/`CONFIRMED_DIFFERENT`, justificativa registrada (mínimo 3
caracteres). Grava `reviewed_by`, `reviewed_at`, `review_notes` e auditoria
`DUPLICATE_MATCH_CONFIRMED`.

### `CONFIRMED_SAME` é não destrutivo

Confirmar que dois `market_properties` são o mesmo imóvel físico **não
funde, não mescla e não apaga nenhum dos dois lados**. Não existe, nesta
fase, nenhuma rotina de merge de entidades. Após `CONFIRMED_SAME`:

- ambos os `market_properties` continuam existindo como linhas distintas;
- todas as `market_observations`, `property_attribute_observations`,
  histórico de preço e trilha de auditoria de cada lado permanecem
  vinculados ao seu `market_property_id` original;
- a única mudança de estado é o `match_status` do par em
  `property_match_candidates` e o registro de auditoria correspondente.

A leitura de "mesmo imóvel" fica registrada como uma relação decidida entre
duas entidades que continuam a existir de forma independente — cabe a
qualquer consumidor futuro (fora do escopo desta fase) decidir como tratar o
par na composição de comparáveis, evitando dupla contagem sem apagar
histórico.

## O que não existe nesta fase

- Não há merge/fusão de `market_properties`.
- Não há resolução automática de duplicidade (toda confirmação exige revisão
  humana com `can_review`).
- Não há regra de elegibilidade automática por raio ou distância — ver
  `docs/GEO_MODEL.md`. A transição para `ELIGIBLE`/`INELIGIBLE` é sempre uma
  decisão humana via `decide_comparable`.
