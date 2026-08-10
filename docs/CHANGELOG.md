# CHANGELOG

Formato: mudanças agrupadas por fase de entrega. Datas em UTC.

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
