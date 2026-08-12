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
