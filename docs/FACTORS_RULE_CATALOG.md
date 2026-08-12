# FACTORS RULE CATALOG

26 regras candidatas do shell **MCDDM — Tratamento por Fatores**.
Todas com `normative_strength = INTERNAL_CONTROL` e procedência
`INTERNAL_DESIGN` (nenhuma se apresenta como exigência de norma).

## Requisitos de entrada (INPUT_REQUIREMENT)

| Código  | Regra                                                                        |
| ------- | ---------------------------------------------------------------------------- |
| FAC-I01 | Tipologia obrigatória do imóvel-objeto e de cada comparável                  |
| FAC-I02 | Área exigida por semântica exata (`PRIVATE_AREA`, `BUILT_AREA`, `LAND_AREA`) |
| FAC-I03 | Natureza do preço explícita (`ASKING_PRICE` vs `TRANSACTION_PRICE`)          |
| FAC-I04 | Data de observação obrigatória em toda leitura de preço                      |
| FAC-I05 | Input ausente é estado declarado, nunca zero ou valor neutro                 |

## Aplicabilidade (APPLICABILITY)

| Código  | Regra                                                        |
| ------- | ------------------------------------------------------------ |
| FAC-A01 | Amostra exige evidência verificada por revisor               |
| FAC-A02 | Semântica de área declarada para todo item da amostra        |
| FAC-A03 | Fator exige escopo (região, tipologia) e vigência declarados |
| FAC-A04 | Duplicidade resolvida antes do uso do comparável             |

## Proibições (PROHIBITION)

| Código  | Regra                                                              |
| ------- | ------------------------------------------------------------------ |
| FAC-P01 | Proibido fator sem procedência                                     |
| FAC-P02 | Proibido valor default de fator                                    |
| FAC-P03 | Proibido converter preço pedido em transação                       |
| FAC-P04 | Proibido substituir semântica de área                              |
| FAC-P05 | Proibido converter feature em ajuste automático                    |
| FAC-P06 | Proibida constante valorativa oculta em código                     |
| FAC-P07 | Proibido uso de fator fora do escopo declarado                     |
| FAC-P08 | Proibida claim normativa sem verificação de conteúdo e localizador |
| FAC-P09 | Proibida metodologia derivada de fixture ou de saída de IA         |

## Diagnósticos (DIAGNOSTIC)

| Código  | Regra                                                               |
| ------- | ------------------------------------------------------------------- |
| FAC-D01 | Fator sem procedência é bloqueador, não aviso                       |
| FAC-D02 | Parâmetro fora de vigência é bloqueador                             |
| FAC-D03 | Concentração amostral é diagnóstico declarado                       |
| FAC-D04 | Divergência de atributo entre observações é preservada e sinalizada |

## Relato (REPORTING)

| Código  | Regra                                                |
| ------- | ---------------------------------------------------- |
| FAC-R01 | Relatar procedência de cada fator aplicado           |
| FAC-R02 | Relatar dados e evidências usadas, com identificador |
| FAC-R03 | Relatar exclusões e seus motivos                     |
| FAC-R04 | Relatar limitações e lacunas conhecidas              |

## O que o catálogo não contém

Nenhuma fórmula aprovada, nenhum parâmetro com valor numérico, nenhum limite de
ajuste. `methodology_formulas` e `methodology_parameters` deste shell estão
vazios por decisão: ver `docs/FACTORS_SOURCE_DOSSIER.md`.

## Auditoria de classificação — Fase 7B

Matriz de classificação das 26 regras. Colunas: classificação, procedência,
fonte, localizador, verificação, status, revisão profissional, notas.

Legenda de classificação:
`INTERNAL_CONTROL` = controle de plataforma; `CANDIDATE_INTERPRETATION` =
controle interno que operacionaliza tema externo, vinculado como `BACKGROUND`
enquanto a fonte primária for inacessível.

| Rule | Classification | Provenance | Source | Locator | Verification | Status | Professional Review | Notes |
| ---- | -------------- | ---------- | ------ | ------- | ------------ | ------ | ------------------- | ----- |
| FAC-I01 | INTERNAL_CONTROL | INTERNAL_DESIGN | Controle interno Fluxa | n/a | fundamento interno escrito | DRAFT | pendente | tipologia sem inferência |
| FAC-I02 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-2) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | tema T20 |
| FAC-I03 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-2) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | temas T16/T17/T18 |
| FAC-I04 | INTERNAL_CONTROL | INTERNAL_DESIGN | Controle interno Fluxa | n/a | fundamento interno | DRAFT | pendente | contemporaneidade |
| FAC-I05 | INTERNAL_CONTROL | INTERNAL_DESIGN | Controle interno Fluxa | n/a | fundamento interno | DRAFT | pendente | ausência é estado |
| FAC-A01 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-2) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | temas T06/T07 |
| FAC-A02 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-2) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | tema T20 |
| FAC-A03 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-2) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | temas T10/T15 |
| FAC-A04 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-2) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | temas T07/T08 |
| FAC-P01 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-2) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | temas T10/T11 |
| FAC-P02 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-2) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | tema T11 |
| FAC-P03 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-2) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | tema T18 |
| FAC-P04 | INTERNAL_CONTROL | INTERNAL_DESIGN | Controle interno Fluxa | n/a | fundamento interno | DRAFT | pendente | semântica de área |
| FAC-P05 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-2) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | tema T19 |
| FAC-P06 | INTERNAL_CONTROL | INTERNAL_DESIGN | Controle interno Fluxa | n/a | fundamento interno | DRAFT | pendente | constante oculta |
| FAC-P07 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-2) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | tema T15 |
| FAC-P08 | INTERNAL_CONTROL | INTERNAL_DESIGN | Controle interno Fluxa | n/a | fundamento interno | DRAFT | pendente | governança de fonte |
| FAC-P09 | INTERNAL_CONTROL | INTERNAL_DESIGN | Controle interno Fluxa | n/a | fundamento interno | DRAFT | pendente | isolamento de fixture |
| FAC-D01 | INTERNAL_CONTROL | INTERNAL_DESIGN | Controle interno Fluxa | n/a | fundamento interno | DRAFT | pendente | diagnóstico |
| FAC-D02 | INTERNAL_CONTROL | INTERNAL_DESIGN | Controle interno Fluxa | n/a | fundamento interno | DRAFT | pendente | vigência |
| FAC-D03 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-2) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | tema T22 |
| FAC-D04 | INTERNAL_CONTROL | INTERNAL_DESIGN | Controle interno Fluxa | n/a | fundamento interno | DRAFT | pendente | divergência preservada |
| FAC-R01 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-1) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | temas T29/T31 |
| FAC-R02 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-1) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | tema T29 |
| FAC-R03 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-1) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | temas T23/T30 |
| FAC-R04 | CANDIDATE_INTERPRETATION | INTERNAL_DESIGN + BACKGROUND(NBR 14653-1) | interno; ABNT METADATA_ONLY | nenhum | conteúdo NÃO verificado | DRAFT | pendente | temas T32/T28 |

### Separação obrigatória

- **PLATFORM GOVERNANCE CONTROLS** (10): FAC-I01, FAC-I04, FAC-I05, FAC-P04,
  FAC-P06, FAC-P08, FAC-P09, FAC-D01, FAC-D02, FAC-D04.
- **METHOD EXTERNAL RULES**: nenhuma. Nenhuma regra é apresentada como
  exigência de norma externa, porque nenhuma fonte externa tem conteúdo
  verificado.
- **CANDIDATE_INTERPRETATION** (16): dependem de acesso primário para
  reclassificação.

Nenhuma regra foi reclassificada para reduzir a contagem de `INTERNAL_DESIGN`:
toda reclassificação exigiria fonte, tipo, relação, verificação, localizador e
motivo.
