# FACTORS METHOD RESEARCH

Pesquisa metodológica controlada para o shell **MCDDM — Tratamento por Fatores**.
Nenhum resultado aqui é afirmação normativa: cada tópico registra o que a
plataforma sabe, o que não sabe e o que falta para saber.

## Regra de honestidade

Estado de cada tópico:

- `INTERNAL_DECLARED` — decidido como controle interno da plataforma, com
  fundamento organizacional escrito.
- `PENDING_PRIMARY_SOURCE` — depende de leitura verificada de fonte primária.
- `OUT_OF_SCOPE_PHASE_7` — reconhecido, deliberadamente não decidido agora.

## Mapa de tópicos

| #   | Tópico                                                 | Estado                 | Onde vive                   |
| --- | ------------------------------------------------------ | ---------------------- | --------------------------- |
| 1   | Definição do método e finalidade                       | INTERNAL_DECLARED      | seção PURPOSE               |
| 2   | Uso pretendido e usuário do resultado                  | INTERNAL_DECLARED      | INTENDED_USE                |
| 3   | Condições de aplicabilidade                            | INTERNAL_DECLARED      | APPLICABILITY, FAC-A01..A04 |
| 4   | Condições de não aplicabilidade                        | INTERNAL_DECLARED      | NON_APPLICABILITY           |
| 5   | Tipologia do imóvel-objeto                             | INTERNAL_DECLARED      | FAC-I01                     |
| 6   | Semântica exata de área                                | INTERNAL_DECLARED      | FAC-I02, FAC-P04            |
| 7   | Natureza do preço (pedido vs transação)                | INTERNAL_DECLARED      | FAC-I03, FAC-P03            |
| 8   | Data de observação e vigência                          | INTERNAL_DECLARED      | FAC-I04, FAC-A03            |
| 9   | Ausência de dado (não é zero)                          | INTERNAL_DECLARED      | FAC-I05                     |
| 10  | Resolução de duplicidade antes do uso                  | INTERNAL_DECLARED      | FAC-A04                     |
| 11  | Procedência obrigatória de fator                       | INTERNAL_DECLARED      | FAC-P01, FAC-R01            |
| 12  | Proibição de fator default                             | INTERNAL_DECLARED      | FAC-P02                     |
| 13  | Proibição de constante valorativa oculta               | INTERNAL_DECLARED      | FAC-P06                     |
| 14  | Escopo de validade de fator (região/tipologia/período) | INTERNAL_DECLARED      | FAC-A03, FAC-P07            |
| 15  | Feature não é ajuste automático                        | INTERNAL_DECLARED      | FAC-P05                     |
| 16  | Diagnóstico de fator sem procedência                   | INTERNAL_DECLARED      | FAC-D01                     |
| 17  | Diagnóstico de parâmetro expirado                      | INTERNAL_DECLARED      | FAC-D02                     |
| 18  | Diagnóstico de concentração amostral                   | INTERNAL_DECLARED      | FAC-D03                     |
| 19  | Diagnóstico de divergência de atributo                 | INTERNAL_DECLARED      | FAC-D04                     |
| 20  | Relato de dados e evidências usadas                    | INTERNAL_DECLARED      | FAC-R02                     |
| 21  | Relato de exclusões e motivos                          | INTERNAL_DECLARED      | FAC-R03                     |
| 22  | Relato de limitações e lacunas                         | INTERNAL_DECLARED      | FAC-R04                     |
| 23  | Proibição de claim normativa sem verificação           | INTERNAL_DECLARED      | FAC-P08                     |
| 24  | Proibição de metodologia derivada de fixture           | INTERNAL_DECLARED      | FAC-P09                     |
| 25  | Requisitos mínimos de amostra                          | PENDING_PRIMARY_SOURCE | DATA_REQUIREMENTS           |
| 26  | Fórmula de homogeneização                              | PENDING_PRIMARY_SOURCE | FORMULAS                    |
| 27  | Ordem e composição de fatores                          | PENDING_PRIMARY_SOURCE | FORMULAS                    |
| 28  | Limites admissíveis de ajuste                          | PENDING_PRIMARY_SOURCE | FORMULAS                    |
| 29  | Saneamento de outliers                                 | PENDING_PRIMARY_SOURCE | DIAGNOSTICS                 |
| 30  | Tratamento de incerteza e intervalo                    | PENDING_PRIMARY_SOURCE | UNCERTAINTY                 |
| 31  | Grau de fundamentação / precisão                       | PENDING_PRIMARY_SOURCE | REPORTING_REQUIREMENTS      |
| 32  | Convergência com outros métodos                        | OUT_OF_SCOPE_PHASE_7   | KNOWN_RISKS                 |

## Limite desta pesquisa

Nenhum número (fator, limite, coeficiente, tamanho mínimo de amostra) foi
introduzido. Todos os tópicos numéricos permanecem `PENDING_PRIMARY_SOURCE`
por decisão explícita — ver `docs/FACTORS_SOURCE_DOSSIER.md`.

## Fase 7B — Topic map consolidado (T01–T32)

Método de pesquisa: inspeção do Normative Registry próprio; hierarquia de fontes
(primária normativa > regulatória > padrão profissional > orientação >
literatura técnica > pesquisa > interna); restrição de acesso: nenhuma cópia
legítima de norma primária disponível neste ambiente e
`RESEARCH_PROVIDER = FIXTURE` (conteúdo de fixture nunca popula metodologia
real).

| Tema | Assunto | Status |
| ---- | ------- | ------ |
| T01 | Definição MCDDM | PENDING_PRIMARY_SOURCE |
| T02 | Posição do tratamento por fatores | PENDING_PRIMARY_SOURCE |
| T03 | Finalidade | CANDIDATE |
| T04 | Aplicabilidade | PENDING_PRIMARY_SOURCE |
| T05 | Não aplicabilidade | PENDING_PRIMARY_SOURCE |
| T06 | Requisitos de dados de mercado | PENDING_PRIMARY_SOURCE |
| T07 | Requisitos de amostra | PENDING_PRIMARY_SOURCE |
| T08 | Semelhança | PENDING_PRIMARY_SOURCE |
| T09 | Variáveis relevantes | CANDIDATE |
| T10 | Origem aceitável de fatores | PENDING_PRIMARY_SOURCE |
| T11 | Derivação de fatores | PENDING_PRIMARY_SOURCE |
| T12 | Referência/paradigma | PENDING_PRIMARY_SOURCE |
| T13 | Expressão de aplicação | PENDING_PRIMARY_SOURCE |
| T14 | Combinação de fatores | PENDING_PRIMARY_SOURCE (gate crítico) |
| T15 | Limites de aplicação | PENDING_PRIMARY_SOURCE |
| T16 | Dados de oferta | PENDING_PRIMARY_SOURCE |
| T17 | Dados de transação | PENDING_PRIMARY_SOURCE |
| T18 | Oferta vs transação | CANDIDATE (controle interno) |
| T19 | Homogeneização | PENDING_PRIMARY_SOURCE |
| T20 | Valores unitários | CANDIDATE (semântica interna) |
| T21 | Resultados homogeneizados | PENDING_PRIMARY_SOURCE |
| T22 | Observações extremas | PENDING_PRIMARY_SOURCE |
| T23 | Exclusões | CANDIDATE |
| T24 | Fundamentação | PENDING_PRIMARY_SOURCE_ACCESS |
| T25 | Precisão | PENDING_PRIMARY_SOURCE_ACCESS |
| T26 | Campo de arbítrio | PENDING_PRIMARY_SOURCE_ACCESS |
| T27 | Extrapolação | PENDING_PRIMARY_SOURCE_ACCESS |
| T28 | Apresentação de cálculo | PENDING_PRIMARY_SOURCE |
| T29 | Documentação de fontes | CANDIDATE |
| T30 | Justificativa profissional | CANDIDATE |
| T31 | Requisitos de relatório | CANDIDATE |
| T32 | Limitações conhecidas | PENDING_PRIMARY_SOURCE |

Nenhum tema foi marcado `VERIFIED_*`: nenhuma fonte externa tem conteúdo
verificado. Os temas estão persistidos em
`method_specification_source_requirements` (`T01_…`–`T32_…`), com
`is_satisfied = false`.

### Matriz de fatores candidatos

| Fator | Source status | Source type | Provenance | Fórmula? | Parâmetro? | Derivação conhecida? | Aplicabilidade? | Limitações? | Fonte primária exigida? | Operational status |
| ----- | ------------- | ----------- | ---------- | -------- | ---------- | -------------------- | --------------- | ----------- | ----------------------- | ------------------ |
| Oferta | METADATA_ONLY | — | nenhuma | não | não | não | não | não | sim | NOT_OPERATIONAL / PENDING_SOURCE |
| Localização | METADATA_ONLY | — | nenhuma | não | não | não | não | não | sim | NOT_OPERATIONAL / PENDING_SOURCE |
| Área | METADATA_ONLY | — | nenhuma | não (NO VERIFIED FORMULA) | não | não | não | não | sim | NOT_OPERATIONAL / PENDING_SOURCE |
| Idade/depreciação | METADATA_ONLY | — | nenhuma | não | não | não | não | não | sim | NOT_OPERATIONAL / PENDING_SOURCE |
| Conservação | METADATA_ONLY | — | nenhuma | não | não | não | não | não | sim | NOT_OPERATIONAL / PENDING_SOURCE |
| Padrão construtivo | METADATA_ONLY | — | nenhuma | não | não | não | não | não | sim | NOT_OPERATIONAL / PENDING_SOURCE |
| Combinação de fatores | METADATA_ONLY | — | nenhuma | não | não | não | não | não | sim | NOT_OPERATIONAL / PENDING_SOURCE |

Nenhum fator existe como registro operacional; nenhuma tabela, curva, expoente
ou coeficiente popular foi cadastrado. Distância geodésica e bairro permanecem
**features factuais**, nunca ajuste.

### Lacunas (gaps)

1. Acesso legítimo a ABNT NBR 14653-1 e -2 (bloqueio principal).
2. Cópia legítima de literatura técnica para `TECHNICAL_SUPPORT`.
3. Provedor de pesquisa real (hoje `FIXTURE`).
4. Revisor humano designado para `CONTENT_VERIFIED` e `LOCATOR_VERIFIED`.

### Batch 01 (T01 / T04 / T07) — resultado

Gate fechado: nenhuma claim de conteúdo pôde ser extraída, porque as fontes
primárias seguem `METADATA_ONLY` sem artefato. Ver
`docs/FACTORS_PRIMARY_SOURCE_REVIEW_BATCH_01.md`.
