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

## Inventário de fontes — Fase 7B

Entradas globais (`organization_id = NULL`). Nenhuma possui conteúdo verificado.

| Fonte | Emissor | Tipo | Autoridade | Acesso | Verif. metadados | Verif. conteúdo | Localizador | Artefato | Jurisdição | Edição/ano | Sucessão |
| ----- | ------- | ---- | ---------- | ------ | ---------------- | --------------- | ----------- | -------- | ---------- | ---------- | -------- |
| ABNT NBR 14653 (família) | ABNT | TECHNICAL_STANDARD | PRIMARY_NORMATIVE | METADATA_ONLY | pendente | não | não | não | BRAZIL | não confirmada | não avaliada |
| ABNT NBR 14653-1 | ABNT | TECHNICAL_STANDARD | PRIMARY_NORMATIVE | METADATA_ONLY | pendente | não | não | não | BRAZIL | não confirmada | não avaliada |
| ABNT NBR 14653-2 | ABNT | TECHNICAL_STANDARD | PRIMARY_NORMATIVE | METADATA_ONLY | pendente | não | não | não | BRAZIL | não confirmada | não avaliada |
| COFECI 1.066/2007 | COFECI | REGULATION | PRIMARY_REGULATORY | METADATA_ONLY | pendente | não | não | não | BRAZIL | 2007 | não avaliada |
| IVS | IVSC | PROFESSIONAL_STANDARD | PROFESSIONAL_STANDARD | METADATA_ONLY | pendente | não | não | não | INTERNATIONAL | não confirmada | não avaliada |
| RICS (IA responsável) | RICS | PROFESSIONAL_GUIDANCE | AUTHORITATIVE_GUIDANCE | METADATA_ONLY | pendente | não | não | não | INTERNATIONAL | não confirmada | não avaliada |
| IBAPE (publicações) | IBAPE | PROFESSIONAL_GUIDANCE | AUTHORITATIVE_GUIDANCE | METADATA_ONLY | pendente | não | não | não | BRAZIL | não confirmada | não avaliada |
| COBREAP (trabalhos técnicos) | IBAPE/COBREAP | TECHNICAL_ARTICLE | ESTABLISHED_TECHNICAL_LITERATURE | METADATA_ONLY | pendente | não | não | não | BRAZIL | coletivo | n/a |
| DANTAS, R. A. | autor/editora a confirmar | BOOK | ESTABLISHED_TECHNICAL_LITERATURE | METADATA_ONLY | pendente | não | não | não | BRAZIL | não confirmada | n/a |
| ABUNAHMAN, S. A. | autor/editora a confirmar | BOOK | ESTABLISHED_TECHNICAL_LITERATURE | METADATA_ONLY | pendente | não | não | não | BRAZIL | não confirmada | n/a |
| FIKER, J. | autor/editora a confirmar | BOOK | ESTABLISHED_TECHNICAL_LITERATURE | METADATA_ONLY | pendente | não | não | não | BRAZIL | não confirmada | n/a |
| Controle interno Fluxa | engenharia da plataforma | INTERNAL_POLICY | INTERNAL_SPECIFICATION | INTERNAL_AUTHORIZED_COPY | sim (interno) | n/a | n/a | n/a | ORGANIZATIONAL | vigente | n/a |

### ABNT gate

`ABNT NBR 14653-1` e `ABNT NBR 14653-2`: `METADATA_ONLY`, sem artefato, sem
localizador e sem `CONTENT_VERIFIED`. Portanto **não sustentam**
`DIRECT_REQUIREMENT`, `DIRECT_PROHIBITION`, fórmula, limiar, tabela, mínimo
amostral, grau de fundamentação, grau de precisão, campo de arbítrio, limite de
extrapolação ou valor de fator. Todos esses itens permanecem
`PENDING_PRIMARY_SOURCE_ACCESS`.

Obras protegidas: apenas referência bibliográfica. Conteúdo não incorporado e
proibido reconstruir norma por material secundário (curso, slide, blog, laudo,
planilha).

### Conflitos de fonte

`methodology_source_conflicts` global permanece vazio: sem duas fontes com
conteúdo verificado, divergência material não é afirmável. Registrar conflito
agora seria invenção.
