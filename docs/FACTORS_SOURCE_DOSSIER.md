# FACTORS SOURCE DOSSIER

Dossiê de fontes do shell **MCDDM — Tratamento por Fatores**
(`method_specifications` v0.1, status `DRAFT`, `organization_id = NULL`).

## Estado real das fontes primárias

| Fonte                                              | Tipo                               | Acesso        | Verificações                      | Pode sustentar claim normativa direta? |
| -------------------------------------------------- | ---------------------------------- | ------------- | --------------------------------- | -------------------------------------- |
| ABNT NBR 14653-1                                   | TECHNICAL_STANDARD                 | METADATA_ONLY | nenhuma de conteúdo               | **NÃO**                                |
| ABNT NBR 14653-2                                   | TECHNICAL_STANDARD                 | METADATA_ONLY | nenhuma de conteúdo               | **NÃO**                                |
| ABNT NBR 14653-3                                   | TECHNICAL_STANDARD                 | METADATA_ONLY | nenhuma de conteúdo               | **NÃO**                                |
| IVS / RICS / COFECI                                | PROFESSIONAL_STANDARD / REGULATION | METADATA_ONLY | nenhuma de conteúdo               | **NÃO**                                |
| Controle interno Fluxa (`11111111-…-00000000000f`) | INTERNAL_POLICY                    | INTERNAL      | fundamento organizacional escrito | sustenta apenas `INTERNAL_CONTROL`     |

Consequência declarada: **nenhuma** regra do shell real afirma "a norma exige X".
Todas as 26 regras candidatas têm `normative_strength = INTERNAL_CONTROL` e
vínculo `INTERNAL_DESIGN` com a fonte de controle interno.

## Por que não há citação normativa

- O texto integral das normas não está no acervo; registrar cláusula sem leitura
  verificada seria alucinação de proveniência.
- `verify_methodology_source` exige artefato vinculado para `CONTENT_VERIFIED`;
  `METADATA_ONLY` bloqueia a verificação de conteúdo por desenho.
- Pesquisa externa automatizada não foi usada como autoridade metodológica:
  `RESEARCH_PROVIDER = FIXTURE` neste ambiente e IA não tem autoridade normativa
  (`docs/AI_GOVERNANCE.md`).

## Lacunas abertas (declaradas, não omitidas)

1. Aquisição legítima do texto das NBR 14653-1/2/3 (base de acesso registrada).
2. `CONTENT_VERIFIED` + localizadores de cláusula por revisor autorizado.
3. Reclassificação das regras que hoje são `INTERNAL_CONTROL` e que, após
   verificação, possam virar `DIRECT_REQUIREMENT` com localizador.
4. Fórmulas e tratamento de incerteza: `PENDING_PRIMARY_SOURCE`.

Enquanto (1) e (2) não existirem, a especificação **não é aprovável** como
representação de norma — apenas como especificação de controle interno.
