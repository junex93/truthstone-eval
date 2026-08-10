# DATASET INTEGRITY

Um dataset é a **base factual congelada** sobre a qual qualquer avaliação futura
será construída. Ele não pode ser uma coleção de referências mutáveis.

## Pré-condições de composição (impostas por trigger)

`protect_frozen_dataset_items` recusa a inclusão de um item quando:

- o campo não está `VERIFIED`;
- o campo pertence a **outro caso de avaliação** (bloqueio de contaminação
  cross-case);
- o campo não possui linhagem completa (artefato/extração/fonte);
- o dataset já está congelado.

## Congelamento (`freeze_dataset`)

RPC `SECURITY DEFINER`, transação única. Exige confirmação explícita literal
`'CONGELAR'` e papel de escrita na organização. A operação:

1. copia o **estado integral de cada campo** para `dataset_item_snapshots`
   (valor bruto, normalizado, numérico, unidade, `field_state`,
   `validation_status`, quem verificou e quando, trecho da fonte, localizador,
   `extraction_id` + versão, `artifact_id` + `artifact_sha256`,
   `evidence_source_id`, `valuation_case_id`, `role_in_dataset`, ordinal);
2. recusa dataset vazio;
3. recusa se algum snapshot não estiver `VERIFIED`;
4. recusa se houver contaminação cross-case;
5. monta o **manifesto canônico** determinístico e calcula SHA-256;
6. grava `frozen_at`, `frozen_by`, `dataset_hash`, `dataset_manifest`,
   `hash_algorithm`, `manifest_schema_version`;
7. grava o evento de auditoria `DATASET_FROZEN` na mesma transação.

## Manifesto canônico

`manifest_schema_version = 'valuation.dataset.manifest/1' (renomeado de 'fluxa.dataset.manifest/1'; ver ADR-019)`, `hash_algorithm = 'SHA-256'`.

Determinismo garantido por:

- ordenação estável dos itens por `item_ordinal` (atribuído no freeze);
- chaves fixas e explícitas em cada item (sem `to_jsonb` de linha inteira);
- timestamps serializados em UTC com formato fixo
  `YYYY-MM-DDTHH24:MI:SS.MSZ`;
- hash calculado sobre `convert_to(manifest::text, 'UTF8')` com `pgcrypto`.

Reexecutar o cálculo sobre o mesmo manifesto reproduz o mesmo hash. O hash cobre
os **valores**, e também os hashes dos artefatos de origem — logo cobre os bytes
originais por transitividade.

## Pós-congelamento

Bloqueados no banco: alterar qualquer metadado do dataset, alterar metadados de
freeze, incluir/alterar/remover itens, atualizar ou apagar snapshots, revisar ou
rejeitar campo que compõe o dataset, apagar a versão de dataset.

Correção legítima = **nova versão de dataset** (`version_number + 1`), preservando
a versão anterior e seu hash.

## Verificação independente

Qualquer auditor pode recalcular:

```sql
SELECT dataset_hash,
       encode(extensions.digest(convert_to(dataset_manifest::text,'UTF8'),'sha256'),'hex') AS recomputed
FROM public.dataset_versions
WHERE id = '<dataset_version_id>';
```

Divergência entre `dataset_hash` e `recomputed` significa manipulação fora do
fluxo oficial e invalida o dataset.
