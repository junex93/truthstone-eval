# CHANGELOG

Formato: mudanças agrupadas por fase de entrega. Datas em UTC.

## Fase 7 — MCDDM / Tratamento por Fatores (specification real)

- Migração versionada popula o shell global `MCDDM — Tratamento por Fatores`
  (v0.1, `DRAFT`): 18 seções, 26 regras candidatas `INTERNAL_CONTROL`, 5 critérios
  de aplicabilidade, 14 requisitos de teste, 10 contratos de saída e 17 conceitos
  no dicionário de dados metodológico.
- Criada fonte de controle interno (`INTERNAL_POLICY`) para sustentar procedência
  `INTERNAL_DESIGN`; nenhuma regra afirma exigência de norma.
- Nenhuma fórmula, parâmetro, fator ou limite numérico foi introduzido: tópicos
  numéricos permanecem `PENDING_PRIMARY_SOURCE` (ABNT segue `METADATA_ONLY`).
- Nova suíte `tests/functional/factors-specification-governance.ts`
  (`bun run test:factors`): **56/56 PASS** — zero regra órfã, zero claim normativa
  sem verificação, zero fator default, isolamento de fixture e ausência de motor.
- Documentação: `FACTORS_SOURCE_DOSSIER.md`, `FACTORS_METHOD_RESEARCH.md`,
  `FACTORS_RULE_CATALOG.md`, `FACTORS_IMPLEMENTATION_BLUEPRINT.md`.

## [Correção] Bootstrap da primeira organização (2026-08-12)

- `org_select` passa a permitir leitura pelo criador (`created_by = auth.uid()`),
  além de membros ativos. O `INSERT ... RETURNING` da criação da organização
  falhava porque a linha recém-criada era invisível antes de existir vínculo.
- `member_insert` corrigida: a cláusula `NOT EXISTS` comparava
  `m2.organization_id = m2.organization_id` (tautologia), inviabilizando o
  primeiro vínculo OWNER. Agora usa `is_org_creator(org)` e
  `org_has_members(org)` (`SECURITY DEFINER`, `search_path = public`,
  `EXECUTE` apenas para `authenticated`), garantindo avaliação fail-closed sem
  depender da visibilidade RLS do registro-pai.
- Verificado negativamente: usuário externo não consegue se inserir em
  organização alheia nem ler a organização; segundo vínculo do mesmo usuário
  continua bloqueado. Regressão de segurança: 84/84 PASS.

## [Fase 4] Property Intelligence Research Engine — closeout

### Motor de pesquisa

- `resolveProvider` sem fallback silencioso: o modo determinístico exige
  `RESEARCH_PROVIDER=FIXTURE`; ausência de `ANTHROPIC_API_KEY` falha com mensagem
  explícita em vez de trocar a origem do dado sem avisar.
- Gate determinístico ampliado: o número declarado pela IA passa a ser comparado
  ao parser determinístico (`NUMERIC_CONFLICT_WITH_PARSER`, estado `DIVERGENT`) e
  preço transacionado apoiado em linguagem de preço pedido é reprovado
  (`TRANSACTION_CLAIM_FROM_ASKING_PRICE`).
- Idempotência: artefato já extraído não é reextraído; fonte já capturada não é
  recapturada.
- Fixture determinística ganhou a página de conflito numérico
  (IA declara 125.000 onde o texto diz R$ 1.250.000).

### Testes

- Nova suíte `tests/functional/research-flow.ts` (28/28): gate offline
  (trecho fabricado, número ausente, conflito numérico, campo fora da allowlist,
  injeção de prompt, oferta ≠ transação, URL inventada) e invariantes de banco
  das tabelas de pesquisa (anon, cross-org, verificação de campo reprovado,
  promoção sem campo verificado, venda sem preço transacionado, UPDATE direto de
  status, delete, escrita de inconsistências e de consumo).
- Reexecutadas sem regressão: `tests/security/negative-tests.ts` (84/84) e
  `tests/functional/market-flow.ts` (33/33).
- Scripts `test:research`, `test:market` e `test:all` adicionados.

### Documentação

- Novos: `RESEARCH_ENGINE.md`, `AI_GOVERNANCE.md`, `PROMPT_INJECTION_DEFENSE.md`.

## [Fase 2] Forensic Integrity Hardening — 2026-08-10

### Banco de dados

- Adicionada `dataset_item_snapshots`: snapshot imutável do estado integral de
  cada campo no instante do congelamento (valores, verificador, linhagem,
  `artifact_sha256`, ordinal determinístico).
- `dataset_versions` ganhou `dataset_manifest`, `dataset_hash`, `hash_algorithm`,
  `manifest_schema_version`.
- RPC `freeze_dataset(_dataset_version_id, _confirmation)`: snapshot + manifesto
  canônico + SHA-256 + auditoria, em transação única; recusa dataset vazio, campo
  não `VERIFIED` e contaminação cross-case.
- RPCs `verify_evidence_field`, `reject_evidence_field`, `revise_evidence_field`
  com exigência de papel e justificativa registrada.
- RPC `transition_case_status`: máquina de estados no banco, pré-requisito de
  dataset congelado, exigência de `ADMIN`/`OWNER` para `COMPLETED` e de
  justificativa para retrocesso/arquivamento.
- Triggers: `guard_case_status`, `guard_evidence_field_insert/update`,
  `guard_membership_changes`, `guard_property_mutability`,
  `prevent_org_migration`, `protect_artifact_immutability`,
  `protect_extraction_immutability`, `protect_frozen_dataset`,
  `protect_frozen_dataset_items`, `record_field_revision`, `block_delete`.
- Chaves estrangeiras compostas `(organization_id, id)` nas tabelas de domínio.
- GRANTs revogados: escrita direta em `audit_log`, `evidence_reviews`,
  `evidence_field_revisions`, `dataset_item_snapshots`, `evidence_fields`
  (UPDATE), `dataset_versions` (UPDATE), `evidence_artifacts` (INSERT/UPDATE);
  `anon` sem acesso a domínio e RPCs.
- Policies de storage validando `organization_id` e `valuation_case_id` do path
  contra o banco.

### Correções encontradas pelos testes negativos

- `GRANT EXECUTE ON FUNCTION public.in_privileged_op() TO authenticated`
  (+ `REVOKE ... FROM anon`): sem isso, toda atualização legítima falhava com
  "permission denied for function in_privileged_op", porque os triggers de guarda
  executam como o papel invocador. Ver ADR-008.

### Performance

- Índices adicionados em foreign keys sem índice: `properties.organization_id`,
  `evidence_field_revisions.organization_id`, `evidence_reviews.organization_id`,
  `evidence_reviews.artifact_id`, `dataset_items.organization_id`,
  `ai_runs.valuation_case_id`.

### Aplicação

- `workspace.server.ts`: `writeAudit` com `actorUserId` derivado do token e
  escrita via cliente admin.
- `cases.functions.ts`: transição de status via RPC.
- `evidence.functions.ts`: verificação/rejeição via RPC; artefato registrado com
  hash SHA-256 calculado no servidor e path validado contra o caso.
- `datasets.functions.ts`: congelamento via RPC `freeze_dataset`.
- UI de evidência impede captura de artefato em fonte sem caso vinculado.

### Testes

- `tests/security/negative-tests.ts`: 49 asserções negativas executáveis
  (anônimo, cross-tenant, RBAC, auditoria, imutabilidade, freeze, storage,
  escalação de privilégio). Execução de 2026-08-10: **49/49 aprovadas**.

### Documentação

- Criados `docs/PRODUCT_CONSTITUTION.md`, `ARCHITECTURE.md`,
  `DATA_GOVERNANCE.md`, `SECURITY.md`, `EVIDENCE_MODEL.md`,
  `DATASET_INTEGRITY.md`, `RBAC.md`, `DECISIONS.md`, `THREAT_MODEL.md`,
  `CHANGELOG.md`.
- `AGENTS.md` com as regras permanentes do projeto (bloco padrão do Lovable
  preservado).

## [Fase 1] Fundação — 2026-08-10

- Backend habilitado (PostgreSQL + Auth + Storage privado).
- Schema inicial: organizações, membros, perfis, casos, imóveis, motor de
  evidência (fontes, artefatos, extrações, campos, revisões), datasets,
  `ai_runs`, `audit_log`, com RLS por organização e papel.
- Buckets privados `evidence-originals`, `property-media`, `generated-reports`.
- Design system pericial (tokens OKLCH), domínio/vocabulário único e schemas Zod.
- Server functions para o ciclo de vida completo; autenticação e-mail/senha e
  Google; telas de dashboard, casos, evidência, datasets, admin e relatórios.

## [Fase 3] Property & Comparable Intelligence Foundation — 2026-08-10

### Banco de dados

- Extensão `postgis` habilitada.
- Novos enums de taxonomia: `property_type_code`, `knowledge_state`,
  `address_normalization_status`, `development_type`,
  `market_observation_type`, `market_observation_status`,
  `transaction_evidence_status`, `value_origin`, `property_match_status`,
  `comparable_candidate_status`, `comparable_inclusion_status`,
  `seller_type`, `quality_dimension_state`, `occupancy_status`,
  `furnished_status`, `condition_status`.
- `properties` expandida com tipologia, áreas, atributos físicos, endereço
  estruturado, `address_normalization_status`, `development_id`, `geo_point`.
- Novas tabelas: `developments`, `market_properties`, `market_observations`,
  `market_observation_price_history`, `property_attribute_observations`,
  `property_canonical_facts`, `property_match_candidates`,
  `comparable_exclusion_reasons` (com taxonomia seed), `comparable_
candidates`, `comparable_decision_history`, `market_source_quality_
assessments`, `derived_values`.
- Triggers novos: `sync_geo_point` (canonicaliza `geo_point` vs. lat/long),
  `guard_canonical_fact` (só `adopt_canonical_fact` escreve fato canônico),
  `guard_market_observation_update` (tipo de observação e vínculo de
  imóvel/caso imutáveis; preço pedido só muda via RPC),
  `guard_market_evidence_scope` (evidência vinculada precisa ser do mesmo
  caso), `guard_comparable_candidate_update` (só `decide_comparable`),
  `guard_match_candidate_update` (só `resolve_property_match`), além de
  `block_delete`/`prevent_org_migration`/`set_updated_at` estendidos às novas
  tabelas.
- RPCs `SECURITY DEFINER` novas: `record_price_observation`,
  `adopt_canonical_fact`, `resolve_property_match`, `decide_comparable`,
  `distance_between_properties_meters`,
  `distance_subject_to_market_property_meters`.
- Índices GiST em `properties.geo_point`, `market_properties.geo_point`,
  `developments.geo_point`, além de índices B-tree de organização/caso/status
  nas novas tabelas.
- GRANTs: leitura ampla para `authenticated` nas novas tabelas; escrita
  direta de decisão (`property_canonical_facts` update, `comparable_
candidates` status, `comparable_decision_history`, `market_observation_
price_history` update/delete) **sem** GRANT — só pelas RPCs oficiais.
  `comparable_exclusion_reasons` com leitura pública para `authenticated`.
- Nomenclatura: migração `20260810195526_...` renomeia o namespace interno de
  GUC/manifesto de `fluxa.*` para `valuation.*` (ver ADR-019 em
  `docs/DECISIONS.md`), sem alterar comportamento.

### Documentação

- Criados `docs/PROPERTY_DATA_MODEL.md`, `docs/MARKET_OBSERVATION_MODEL.md`,
  `docs/COMPARABLE_GOVERNANCE.md`, `docs/GEO_MODEL.md`.
- `docs/PRODUCT_CONSTITUTION.md`: novo Artigo 9 com as oposições conceituais
  permanentes desta fase.
- `docs/ARCHITECTURE.md`, `docs/DATA_GOVERNANCE.md`, `docs/EVIDENCE_MODEL.md`,
  `docs/SECURITY.md`, `docs/THREAT_MODEL.md` atualizados com o novo domínio.
- `docs/DECISIONS.md`: ADR-011 a ADR-019.
- `AGENTS.md`: nova seção 13 com regras permanentes específicas de mercado e
  comparáveis.

### Limitações declaradas nesta fase

- Não existe, no código de aplicação (`src/lib`, `src/routes`), nenhuma
  server function, formulário ou tela para as novas tabelas — apenas o
  schema, os triggers e as RPCs no banco, mais o vocabulário em
  `src/lib/domain/constants.ts`. A camada de aplicação (server functions e
  rotas) para imóveis de mercado e comparáveis **não foi implementada** até o
  momento deste documento.
- Não há geocoding, regra de raio/elegibilidade geográfica, merge de imóveis
  duplicados, promoção de imóvel de mercado a avaliando, nem score de
  completude/confiança sobre atributos ou fontes.

## [Fase 3C] Closeout — Property & Comparable Intelligence — 2026-08-11

### Banco de dados

- `record_price_observation` passou a validar a linhagem completa de
  `_evidence_field_id` (campo → extração → artefato → fonte → organização e
  caso): campo de outro caso, de outra organização ou inexistente é recusado.
  `NULL` continua aceito por desenho do modelo.
- Menor privilégio explícito: `REVOKE INSERT, UPDATE, DELETE` da role
  `authenticated` em `comparable_decision_history`,
  `property_canonical_facts`, `property_attribute_observations` (mantido
  `INSERT`) e `market_observation_price_history` (mantido `INSERT`). Escrita de
  decisão e de fato canônico só pelas RPCs oficiais.

### Testes

- `tests/security/negative-tests.ts`: 84 asserções (antes 75). Novas provas de
  linhagem cross-case/cross-org em `record_price_observation` e de
  append-only em `comparable_decision_history` com comparação de estado
  antes/depois — resposta HTTP de sucesso com 0 linhas afetadas não é aceita
  como prova; o conteúdo é relido e comparado byte a byte.
- `tests/functional/market-flow.ts` (novo): 33 asserções positivas cobrindo o
  ciclo completo do caso, incluindo `UNKNOWN != ZERO`,
  `ASKING != TRANSACTION`, histórico de preço append-only, divergência
  preservada, adoção de fato canônico e `EXCLUDED != DELETED`.
- Execução: 84/84 e 33/33 aprovadas, 0 falhas.

### Documentação

- `docs/ARCHITECTURE.md`: mapa de arquivos atualizado com a camada de aplicação
  de mercado e comparáveis e as rotas por aba do caso (a nota "não
  implementado" foi removida por ser falsa).
- `docs/SECURITY.md`, `docs/THREAT_MODEL.md`, `tests/security/README.md`:
  contagens reais de asserções e referência ao teste funcional positivo.

## Fase 5B — Market Evidence Intelligence & Sample Readiness (camada de aplicação)

- Banco: `market_source_domain` com `search_path` fixo; novas RPCs somente-leitura
  `verify_snapshot_integrity` (compara hash gravado com hash recalculado do manifesto)
  e `market_intelligence_report` (diagnóstico factual agregado do caso). Ambas
  `SECURITY DEFINER`, `search_path = public`, `EXECUTE` revogado de PUBLIC/`anon`.
- TypeScript: `src/lib/domain/intelligence.ts` (vocabulário e contrato de leitura),
  `src/lib/validation/intelligence-schemas.ts` (justificativa obrigatória em toda
  decisão), `src/lib/market-intelligence.server.ts` e
  `src/lib/market-intelligence.functions.ts` (retratos, identidade, seleção de
  amostra, ocorrências de qualidade, prontidão, verificação de integridade).
- UI: aba "Inteligência de Mercado" (`cases/$caseId/intelligence`) com matriz de
  evidência por imóvel físico independente, independência de fontes, distribuição
  temporal e de idade, diagnóstico espacial, cobertura de atributos
  (conhecido != verificado), distribuições de preço pedido e transacionado
  separadas, funil de evidência e perdas, lacunas de pesquisa, retratos com
  verificação de hash, seleção de amostra, ocorrências e prontidão.
- Limitação declarada: nenhum cálculo de valor, ajuste, fator ou inferência
  estatística. Cerca de 1,5·IQR sinaliza "possível observação extrema" para
  leitura humana; nada é removido do acervo.

## Fase 6 — encerramento (governança metodológica)

### Segurança

- Guardas metodológicas convertidas para `SECURITY DEFINER` com comportamento
  fail-closed: `guard_specification_child`, `guard_rule_source`,
  `guard_source_verification`, `guard_methodology_source_artifact`,
  `guard_methodology_locator_artifact`, `guard_source_conflict_insert`.
- Nova guarda `guard_methodology_parent_immutable`: organização e registro-pai de
  regras e fórmulas não mudam após criação.
- Revogado EXECUTE de `PUBLIC`, `anon` e `authenticated` nas funções de trigger.
- Corrigida vulnerabilidade de gravação cross-tenant de fórmula (RLS tornava o
  registro-pai invisível e a guarda `INVOKER` retornava sem validar).
- Corrigido erro de casting em `specification_completeness` (rótulos de requisito).

### Testes

- `tests/functional/methodology-governance-flow.ts`: 161/161 PASS — fluxo
  legítimo, RBAC, imutabilidade, estabilidade do selo SHA-256, isolamento
  cross-tenant fail-closed, `METADATA_ONLY`, atomicidade e taxonomia de auditoria.
- Regressão completa: segurança 84/84, mercado 33/33, pesquisa 28/28,
  inteligência de mercado 81/81.
- Linter do banco: nenhum ERROR; avisos remanescentes apenas da classe `0029`.

### Documentação

- Novos: `METHODOLOGY_GOVERNANCE.md`, `NORMATIVE_REGISTRY.md`,
  `METHOD_SPECIFICATION_STANDARD.md`, `METHODOLOGY_SOURCE_GOVERNANCE.md`,
  `FORMULA_AND_PARAMETER_GOVERNANCE.md`, `METHODOLOGY_CHANGE_CONTROL.md`,
  `METHODOLOGY_TESTING_STANDARD.md`.
- Atualizados: `ARCHITECTURE.md`, `DATA_GOVERNANCE.md`, `SECURITY.md`,
  `THREAT_MODEL.md`, `DECISIONS.md`.

### Limitações declaradas

- Nenhuma lógica de valoração em produção: fatores e inferência seguem shells
  `DRAFT` vazias, sem fórmula operacional nem parâmetro numérico.
- Normas pagas permanecem `METADATA_ONLY`; aderência textual não é verificável.

## Fase 7B — Verificação de fontes e reclassificação de regras (MCDDM Fatores)

- Inventário bibliográfico ampliado (IBAPE, COBREAP, Dantas, Abunahman, Fiker),
  todos `METADATA_ONLY` / `PENDING_METADATA_REVIEW`; literatura técnica nunca
  elevada a `PRIMARY_NORMATIVE`.
- Topic map T01–T32 persistido em `method_specification_source_requirements`
  com status explícito; nenhum tema marcado como satisfeito.
- Auditoria das 26 regras: 10 permanecem controle interno puro; 16 receberam
  vínculo `BACKGROUND` ao tema externo correspondente (nunca `DIRECT_*`),
  preservando o `INTERNAL_DESIGN` original.
- ABNT gate mantido: NBR 14653-1/-2 em `METADATA_ONLY` não sustentam exigência,
  proibição, fórmula, limiar, fundamentação, precisão, arbítrio ou extrapolação.
- Seções `SOURCE_REFERENCES`, `LIMITATIONS` (registro de questões abertas) e
  `KNOWN_RISKS` atualizadas.
- Documentação: criado `docs/FACTORS_APPLICABILITY.md` (5º documento faltante);
  atualizados dossiê de fontes, catálogo de regras, pesquisa e blueprint.
- Testes: `test:factors` 91/91 PASS (baseline 56, ampliado com asserts de topic
  map, gates críticos, má classificação e reclassificação). Regressões:
  metodologia 161/161, inteligência de mercado 81/81, segurança 84/84,
  mercado 33/33, pesquisa 28/28. Typecheck e build PASS.
- `specification_completeness`: DRAFT, `is_complete=false`, 0 blockers,
  warnings `NO_PARAMETERS_REGISTERED` / `NO_FORMULA_REGISTERED`, 42 requisitos
  de fonte pendentes. Nenhum motor de valoração implementado.
