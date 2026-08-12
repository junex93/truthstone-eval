# DECISIONS (ADR)

## ADR-001 — Invariantes no PostgreSQL, não na aplicação
**Status:** aceito.
**Contexto:** a Data API é alcançável diretamente com o token do usuário.
**Decisão:** cada invariante forense vive como GRANT + RLS + trigger + RPC.
**Consequência:** mais atrito para evoluir schema; qualquer cliente (inclusive
scripts) herda as garantias. Provado por testes negativos executáveis.

## ADR-002 — Operações críticas apenas por RPC `SECURITY DEFINER`
**Status:** aceito.
**Decisão:** verificação, rejeição, revisão, congelamento e transição de status
só existem como RPC; os GRANTs de UPDATE correspondentes foram revogados.
**Consequência:** o advisor de segurança acusa WARN de "definer executável por
autenticado" — aceito e documentado, pois é o mecanismo que evita dar privilégio
direto de tabela ao usuário.

## ADR-003 — Dataset congelado é snapshot de valores, não referência
**Status:** aceito.
**Contexto:** referenciar `evidence_field_id` não congela nada se o campo mudar.
**Decisão:** `dataset_item_snapshots` copia o estado integral no instante do
freeze e o manifesto canônico é hasheado com SHA-256.
**Consequência:** duplicação de dados; em troca, reprodutibilidade verificável.

## ADR-004 — Não existe exclusão física de prova, decisão ou trilha
**Status:** aceito.
**Decisão:** `block_delete` em auditoria, revisões, snapshots, artefatos e fontes;
"remover" um caso é arquivar com justificativa.
**Consequência:** conflito em aberto com direito de exclusão (LGPD); exige
procedimento administrativo específico, ainda não implementado.

## ADR-005 — Hash sempre calculado no servidor
**Status:** aceito.
**Decisão:** o servidor relê os bytes do bucket privado e calcula SHA-256;
`hash_computed_by = 'SERVER'`.
**Consequência:** custo de I/O por upload; hash do cliente jamais é prova.

## ADR-006 — Chaves estrangeiras compostas `(organization_id, id)`
**Status:** aceito.
**Decisão:** integridade de tenant garantida pelo banco, não pelo cuidado do
código ao preencher `organization_id`.
**Consequência:** índices únicos extras e migrações mais verbosas.

## ADR-007 — `organization_id` imutável
**Status:** aceito.
**Decisão:** trigger recusa alteração; transferência exige operação
administrativa formal (não implementada).

## ADR-008 — `EXECUTE` em `in_privileged_op()` para `authenticated`
**Status:** aceito com ressalva (descoberto pelos testes negativos).
**Contexto:** funções de trigger executam como o papel invocador; sem esse
`EXECUTE`, **toda** atualização legítima falhava com "permission denied for
function in_privileged_op".
**Decisão:** conceder `EXECUTE` a `authenticated` e revogar de `anon`.
**Ressalva:** a função apenas lê um GUC de transação, gravado somente dentro das
RPCs `SECURITY DEFINER`. Qualquer nova RPC exposta que permita `set_config`
quebraria a garantia — revisar em toda nova RPC.

## ADR-009 — Máquina de estados duplicada (banco + `constants.ts`)
**Status:** aceito.
**Decisão:** o banco é autoridade; a cópia no TypeScript existe só para a UI.
**Consequência:** risco de divergência; mudanças devem alterar os dois lados na
mesma entrega.

## ADR-010 — Métodos avaliatórios fora desta fase
**Status:** aceito.
**Decisão:** fatores, inferência estatística, AVM, ML, SHAP, convergência, laudo
automático, agentes e RAG só serão construídos sobre datasets congelados, após o
hardening da base factual.

## ADR-011 — Imóvel avaliando, imóvel de mercado e empreendimento como entidades separadas
**Status:** aceito.
**Contexto:** um laudo compara o imóvel avaliando contra imóveis observados no
mercado; tratá-los como a mesma tabela obrigaria gambiarras de tipo/escopo.
**Decisão:** `properties` (avaliando), `market_properties` (mercado,
escopado por caso) e `developments` (empreendimento) são tabelas distintas
com FKs compostas por organização e caso.
**Consequência:** duplicação parcial de vocabulário de atributos entre
`properties` e `market_properties`; em troca, cada entidade tem semântica e
regras de imutabilidade próprias.

## ADR-012 — Observação de atributo separada de fato canônico
**Status:** aceito.
**Contexto:** fontes divergem sobre o mesmo atributo; resolver a divergência
automaticamente violaria o Artigo 5 da constituição do produto.
**Decisão:** `property_attribute_observations` (append-only, um por
evidência) e `property_canonical_facts` (um valor vigente por atributo/
entidade, escrito só por `adopt_canonical_fact`, superado nunca apagado).
**Consequência:** toda leitura de "o valor do atributo X" precisa decidir
explicitamente se quer a observação bruta ou o fato adotado; não há atalho
que confunda os dois.

## ADR-013 — Preço pedido e preço transacionado como colunas mutuamente exclusivas
**Status:** aceito.
**Decisão:** `market_observations` usa `CHECK` constraints para impedir que
`asking_*` e `transaction_*` sejam preenchidos fora do `observation_type`
correspondente; `observation_type` é imutável após criação.
**Consequência:** registrar uma venda concretizada exige nova observação
(`CLOSED_SALE`), nunca a edição de uma oferta existente.

## ADR-014 — Status `REMOVED` sem status `SOLD`
**Status:** aceito.
**Contexto:** o desaparecimento de um anúncio é frequentemente mal-usado como
proxy de venda em produtos imobiliários.
**Decisão:** o enum `market_observation_status` não contém `SOLD`. Venda só é
representada por uma observação distinta do tipo `CLOSED_SALE`/`CLOSED_RENT`
com evidência própria.
**Consequência:** consumidores futuros não podem "contar vendas" a partir de
anúncios retirados; precisam de evidência de transação.

## ADR-015 — Decisão de comparável e de duplicidade só por RPC `SECURITY DEFINER`
**Status:** aceito.
**Decisão:** `decide_comparable` e `resolve_property_match` são as únicas
portas de escrita para `comparable_candidates.candidate_status/inclusion_
status` e `property_match_candidates.match_status`; triggers `guard_
comparable_candidate_update` e `guard_match_candidate_update` recusam
`UPDATE` fora dessas RPCs.
**Consequência:** mesmo o service role de aplicação, ao escrever fora da RPC,
seria bloqueado — a garantia está no trigger, não na disciplina do chamador.

## ADR-016 — Confirmação de duplicidade não funde nem apaga
**Status:** aceito.
**Contexto:** merge de entidades destrói proveniência e é irreversível.
**Decisão:** `CONFIRMED_SAME` altera apenas o `match_status` do par em
`property_match_candidates`; os dois `market_properties` e todo o histórico
de cada lado permanecem intactos e independentes.
**Consequência:** qualquer consolidação de comparáveis duplicados fica para
uma camada de consumo futura (não implementada), que decide como tratar o
par sem perder dado.

## ADR-017 — `geo_point` (PostGIS geography) como posição canônica; lat/long como espelho
**Status:** aceito.
**Decisão:** `sync_geo_point()` recalcula, na mesma transação de escrita, o
lado que não foi informado (`geo_point` a partir de lat/long, ou o inverso).
**Consequência:** impossível gravar posição divergente entre as duas
representações; toda consulta espacial deve usar `geo_point` com índice
GiST.

## ADR-018 — Geocoding e regra de raio fora de escopo
**Status:** aceito.
**Decisão:** nenhuma integração de geocoding é chamada pelo sistema; as RPCs
de distância (`distance_between_properties_meters`, `distance_subject_to_
market_property_meters`) só calculam metros entre pontos já preenchidos e
nunca decidem elegibilidade de comparável.
**Consequência:** preenchimento de coordenadas é manual/por evidência;
qualquer regra de raio de comparabilidade permanece decisão humana via
`decide_comparable`.

## ADR-019 — Namespace interno `fluxa.*` renomeado para `valuation.*`
**Status:** aceito (compatibilidade histórica documentada).
**Contexto:** o GUC de transação e o `manifest_schema_version` usavam o
prefixo herdado `fluxa` (nome de produto anterior). A migração
`20260810195526_da6447e9-1470-422b-b1ff-5e7f1532fe3a.sql` substitui, função
por função, `fluxa.privileged_op`/`fluxa.change_reason`/
`fluxa.dataset.manifest/1` por `valuation.privileged_op`/`valuation.change_
reason`/`valuation.dataset.manifest/1`, preservando byte a byte o
comportamento, a autorização e as regras de imutabilidade.
**Consequência:** datasets já congelados **antes** desta migração carregam
`manifest_schema_version = 'fluxa.dataset.manifest/1'` no seu manifesto — essa
string é histórica, faz parte do hash já calculado e **não deve ser
reescrita**: alterá-la invalidaria o SHA-256 registrado. Documentação e
schema novos usam exclusivamente `valuation.*`. Migrações aplicadas
anteriores a esta renomeação (`20260810172137_...`, `20260810172605_...`)
mantêm o texto literal `fluxa.*` porque descrevem o estado do banco no
momento em que foram aplicadas; migrações são histórico imutável e não são
editadas retroativamente.

## ADR-0xx — IA é geradora de candidato, nunca de fato
**Status:** aceito.
**Decisão:** o provedor de IA está atrás da interface `ResearchProvider`, sem
acesso a banco, storage, RPC ou segredo; toda saída passa por gate determinístico
e por verificação humana registrada.
**Consequência:** trocar modelo/fornecedor não toca regra de domínio; a
plataforma nunca depende da honestidade do modelo.

## ADR-0xx — Sem fallback silencioso de provedor
**Status:** aceito.
**Contexto:** cair automaticamente em fixture quando falta a chave mascara a
origem do dado, o que é inaceitável em contexto pericial.
**Decisão:** o modo determinístico exige `RESEARCH_PROVIDER=FIXTURE`; sem chave
real a operação falha com mensagem explícita.

## ADR-0xx — Número da IA é apenas hipótese; o parser é a autoridade
**Status:** aceito.
**Decisão:** o valor numérico é sempre recalculado do texto bruto por parser
determinístico; divergência com o número declarado pela IA é preservada como
`DIVERGENT` com inconsistência registrada, nunca resolvida automaticamente.

## ADR — Fase 6 (metodologia e registro normativo)

- **ADR-6.1 — Registro declarativo, não executável.** A camada descreve métodos;
  não há motor de cálculo. Evita produzir número sem base congelada.
- **ADR-6.2 — Fórmula simbólica.** Expressão é documental e o banco recusa código
  executável, eliminando superfície de execução arbitrária.
- **ADR-6.3 — Metadados ≠ conteúdo ≠ localizador.** Permite citar norma paga sem
  reproduzi-la e impede verificação textual sem base legítima de acesso.
- **ADR-6.4 — Aprovação com separação de funções e selo SHA-256.** Submissor nunca
  aprova; aprovação sela manifesto canônico verificável.
- **ADR-6.5 — Guardas de escopo em `SECURITY DEFINER` fail-closed.** Guarda
  `INVOKER` sob RLS não vê o pai de outra org e falhava em aberto; agora pai
  invisível resulta em recusa.
- **ADR-6.6 — Taxonomia de auditoria por ato.** Um evento
  `METHODOLOGY_SOURCE_VERIFIED` cobre as três naturezas de verificação, com o
  tipo específico no payload e na linha de verificação.
- **ADR-6.7 — Shells vazias para fatores e inferência.** Métodos existem como
  conceito sem fórmula ou parâmetro de produção, até pedido explícito.
