# EVIDENCE MODEL

## Cadeia de custódia

```
evidence_sources          quem/onde: tipo, nome, URL, publicador, data de acesso
  └─ evidence_artifacts   os bytes: bucket, path, file_size, sha256_hash, captured_at
       └─ evidence_extractions   leitura do artefato: processor_type, versão, raw_output
            └─ evidence_fields   candidato atômico: valor bruto, normalizado, numérico,
                                 unidade, field_state, source_excerpt, source_locator
                 ├─ evidence_field_revisions   histórico completo, append-only
                 ├─ evidence_reviews           decisões de revisão, append-only
                 └─ dataset_items → dataset_item_snapshots
```

## Enums normativos

- `source_type`: OFFICIAL_PUBLIC_SOURCE, PUBLIC_REGISTRY, PRIVATE_DOCUMENT,
  TRANSACTION_EVIDENCE, REAL_ESTATE_LISTING, BROKER_INFORMATION, USER_PROVIDED,
  FIELD_INSPECTION, OTHER
- `processor_type`: MANUAL, DETERMINISTIC_PARSER, OCR, LLM, COMPUTER_VISION,
  EXTERNAL_API
- `field_state`: PRESENT, NOT_FOUND, NOT_INFORMED, NOT_VERIFIABLE, DIVERGENT,
  PENDING_VALIDATION
- `validation_status`: CAPTURED, EXTRACTED, PENDING_REVIEW, VERIFIED, REJECTED

## Integridade do artefato

`sha256_hash` é calculado **no servidor**, lendo os bytes de volta do bucket
privado (`registerEvidenceArtifact`), e `hash_computed_by = 'SERVER'`. Um hash
enviado pelo navegador nunca é aceito como mecanismo de integridade.
Após a criação, `storage_path`, `sha256_hash`, `file_size`, `evidence_source_id`
e `captured_at` são imutáveis; `DELETE` é bloqueado por trigger.

## Ciclo de vida de um campo

| Ação | Porta única | Efeito |
| --- | --- | --- |
| Criar candidato | server function (INSERT permitido) | `PENDING_REVIEW`; não pode nascer `VERIFIED` |
| Verificar | RPC `verify_evidence_field` | exige papel de revisão, nota técnica e evidência; grava review + auditoria |
| Rejeitar | RPC `reject_evidence_field` | exige motivo; remove o campo de datasets não congelados |
| Revisar valor | RPC `revise_evidence_field` | exige motivo; **invalida** a verificação e volta para `PENDING_REVIEW` |

Edição direta (`UPDATE` via Data API) é impossível: não há `GRANT` de UPDATE em
`evidence_fields` para `authenticated`, e os triggers `guard_evidence_field_*`
recusariam a alteração de decisão mesmo com privilégio.

## Ausência e divergência

Ausência nunca é `NULL` silencioso: é `field_state` explícito. Divergência entre
fontes é registrada como `DIVERGENT` e exige decisão humana justificada — o
sistema não escolhe o valor "mais provável".

## Evidência aplicada a imóveis e mercado (Fase 3)

O mesmo motor de evidência (`evidence_sources` → `evidence_artifacts` →
`evidence_extractions` → `evidence_fields`) alimenta, opcionalmente, três
novas tabelas de domínio:

- `property_attribute_observations.evidence_field_id`/`evidence_source_id` —
  o que uma evidência afirma sobre um atributo de imóvel;
- `market_observations.evidence_source_id`/`primary_artifact_id` — a fonte de
  um anúncio, cotação ou transação;
- `market_observation_price_history.evidence_source_id`/`evidence_field_id` —
  a evidência de cada leitura histórica de preço.

O trigger `guard_market_evidence_scope` impede que a evidência vinculada
pertença a um caso de avaliação diferente do registro de mercado — a mesma
proteção anti-contaminação cross-case do congelamento de dataset
(`docs/DATASET_INTEGRITY.md`), aplicada agora também ao domínio de mercado.

Regra de adoção: `adopt_canonical_fact` só aceita uma observação de origem
`EVIDENCE_EXTRACTION` se o `evidence_field_id` vinculado estiver `VERIFIED` —
`AI OUTPUT != VERIFIED FACT` também aqui: uma extração de IA/OCR/parser não
verificada não pode virar fato canônico do imóvel. Origem `EXTERNAL_API`
nunca é adotável como fato, mesmo verificada. Ver `docs/PROPERTY_DATA_
MODEL.md`.

## Extrações

Uma extração concluída (`COMPLETED` / `REVIEW_REQUIRED`) não pode ter
`raw_output`, processador, versão ou prompt alterados. Reprocessar significa
criar `version_number + 1`, preservando o histórico de como cada leitura foi
produzida.
