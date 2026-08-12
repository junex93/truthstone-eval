# FACTORS APPLICABILITY

Aplicabilidade do shell **MCDDM — Tratamento por Fatores**
(`method_specifications` `33333333-…-000000000001`, status `DRAFT`).

Documento criado na Fase 7B. Era **o quinto documento faltante** da rodada
anterior (7A entregou `FACTORS_METHOD_RESEARCH.md`,
`FACTORS_SOURCE_DOSSIER.md`, `FACTORS_RULE_CATALOG.md` e
`FACTORS_IMPLEMENTATION_BLUEPRINT.md`).

## 1. SOURCE-BACKED APPLICABILITY

Nenhuma condição de aplicabilidade desta especificação é sustentada por fonte
externa com conteúdo verificado. ABNT NBR 14653-1 e -2 permanecem
`METADATA_ONLY`; COFECI, IVS, RICS, IBAPE e literatura técnica idem.

Consequência: a lista é **vazia por integridade**, não por omissão.

## 2. INTERNAL CONTROLS (aplicabilidade da plataforma)

Condições impostas pela plataforma, com procedência `INTERNAL_DESIGN` na fonte
`Controle interno Fluxa`. Não são exigências normativas de terceiros.

| Regra   | Condição interna                                                  |
| ------- | ----------------------------------------------------------------- |
| FAC-A01 | Cada referência exige evidência com fonte e verificação humana     |
| FAC-A02 | Semântica de área declarada e idêntica entre avaliando e amostra   |
| FAC-A03 | Fator só é elegível com escopo territorial/tipológico e vigência   |
| FAC-A04 | Duplicidade de anúncio resolvida antes de compor amostra          |
| FAC-I01 | Tipologia é input obrigatório, sem inferência automática           |
| FAC-I02 | Área exigida por conceito exato (privativa, construída, terreno)   |
| FAC-I03 | Natureza do preço explícita (pedido vs transacionado)             |
| FAC-I04 | Data de observação obrigatória                                    |
| FAC-I05 | Input ausente é estado declarado, nunca zero                       |

## 3. CANDIDATES (temas com correspondência externa reconhecida)

Controles internos que **operacionalizam** temas metodológicos externos, hoje
vinculados apenas como `BACKGROUND` (identificação de tema) às entradas ABNT:

| Regra interna | Tema externo (topic map) |
| ------------- | ------------------------ |
| FAC-A01       | T06, T07                 |
| FAC-A02       | T20                      |
| FAC-A03       | T10, T15                 |
| FAC-A04       | T07, T08                 |
| FAC-D03       | T22                      |
| FAC-I02       | T20                      |
| FAC-I03       | T16, T17, T18            |
| FAC-P01       | T10, T11                 |
| FAC-P02       | T11                      |
| FAC-P03       | T18                      |
| FAC-P05       | T19                      |
| FAC-P07       | T15                      |
| FAC-R01..R04  | T23, T28, T29, T30, T31, T32 |

Reclassificação para `INTERPRETATION` ou `DIRECT_REQUIREMENT` só ocorre após
artefato legítimo + `CONTENT_VERIFIED` + localizador verificado por revisor.

## 4. PENDING SOURCE

Condições que só podem existir com fonte primária verificada e que **não foram
inventadas**: definição normativa do método, semelhança exigida, mínimo
amostral, origem/derivação/combinação admissível de fatores, limites de
aplicação, tratamento de oferta, homogeneização, discrepantes, grau de
fundamentação, grau de precisão, campo de arbítrio, extrapolação.

Status registrado no banco: `PENDING_PRIMARY_SOURCE` /
`PENDING_PRIMARY_SOURCE_ACCESS` (T01–T02, T04–T08, T10–T17, T19, T21, T22,
T24–T28, T32).

## 5. NON-APPLICABILITY

Somente restrições internas declaradas (nenhuma citação normativa):

- amostra sem evidência verificada;
- avaliando ou referência sem semântica de área declarada;
- fator sem fonte, derivação e vigência;
- fator fora do escopo declarado (`FAC-P07`);
- referências que são o mesmo imóvel sem resolução de duplicidade;
- ausência de input obrigatório.

## 6. OPEN QUESTIONS

- `SOURCE_ACCESS_GAP` — acesso legítimo à ABNT NBR 14653-1/-2.
- `PROFESSIONAL_DECISION_REQUIRED` — quais controles internos serão declarados
  como interpretação de exigência externa após o acesso.
- `TECHNICAL_RESEARCH_REQUIRED` — critérios de semelhança e de discrepantes.
- `IMPLEMENTATION_DESIGN_LATER` — expressão de aplicação e combinação.

Nenhum motor, cálculo, fator, expoente ou limiar existe nesta fase.
