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

| # | Tópico | Estado | Onde vive |
| --- | --- | --- | --- |
| 1 | Definição do método e finalidade | INTERNAL_DECLARED | seção PURPOSE |
| 2 | Uso pretendido e usuário do resultado | INTERNAL_DECLARED | INTENDED_USE |
| 3 | Condições de aplicabilidade | INTERNAL_DECLARED | APPLICABILITY, FAC-A01..A04 |
| 4 | Condições de não aplicabilidade | INTERNAL_DECLARED | NON_APPLICABILITY |
| 5 | Tipologia do imóvel-objeto | INTERNAL_DECLARED | FAC-I01 |
| 6 | Semântica exata de área | INTERNAL_DECLARED | FAC-I02, FAC-P04 |
| 7 | Natureza do preço (pedido vs transação) | INTERNAL_DECLARED | FAC-I03, FAC-P03 |
| 8 | Data de observação e vigência | INTERNAL_DECLARED | FAC-I04, FAC-A03 |
| 9 | Ausência de dado (não é zero) | INTERNAL_DECLARED | FAC-I05 |
| 10 | Resolução de duplicidade antes do uso | INTERNAL_DECLARED | FAC-A04 |
| 11 | Procedência obrigatória de fator | INTERNAL_DECLARED | FAC-P01, FAC-R01 |
| 12 | Proibição de fator default | INTERNAL_DECLARED | FAC-P02 |
| 13 | Proibição de constante valorativa oculta | INTERNAL_DECLARED | FAC-P06 |
| 14 | Escopo de validade de fator (região/tipologia/período) | INTERNAL_DECLARED | FAC-A03, FAC-P07 |
| 15 | Feature não é ajuste automático | INTERNAL_DECLARED | FAC-P05 |
| 16 | Diagnóstico de fator sem procedência | INTERNAL_DECLARED | FAC-D01 |
| 17 | Diagnóstico de parâmetro expirado | INTERNAL_DECLARED | FAC-D02 |
| 18 | Diagnóstico de concentração amostral | INTERNAL_DECLARED | FAC-D03 |
| 19 | Diagnóstico de divergência de atributo | INTERNAL_DECLARED | FAC-D04 |
| 20 | Relato de dados e evidências usadas | INTERNAL_DECLARED | FAC-R02 |
| 21 | Relato de exclusões e motivos | INTERNAL_DECLARED | FAC-R03 |
| 22 | Relato de limitações e lacunas | INTERNAL_DECLARED | FAC-R04 |
| 23 | Proibição de claim normativa sem verificação | INTERNAL_DECLARED | FAC-P08 |
| 24 | Proibição de metodologia derivada de fixture | INTERNAL_DECLARED | FAC-P09 |
| 25 | Requisitos mínimos de amostra | PENDING_PRIMARY_SOURCE | DATA_REQUIREMENTS |
| 26 | Fórmula de homogeneização | PENDING_PRIMARY_SOURCE | FORMULAS |
| 27 | Ordem e composição de fatores | PENDING_PRIMARY_SOURCE | FORMULAS |
| 28 | Limites admissíveis de ajuste | PENDING_PRIMARY_SOURCE | FORMULAS |
| 29 | Saneamento de outliers | PENDING_PRIMARY_SOURCE | DIAGNOSTICS |
| 30 | Tratamento de incerteza e intervalo | PENDING_PRIMARY_SOURCE | UNCERTAINTY |
| 31 | Grau de fundamentação / precisão | PENDING_PRIMARY_SOURCE | REPORTING_REQUIREMENTS |
| 32 | Convergência com outros métodos | OUT_OF_SCOPE_PHASE_7 | KNOWN_RISKS |

## Limite desta pesquisa

Nenhum número (fator, limite, coeficiente, tamanho mínimo de amostra) foi
introduzido. Todos os tópicos numéricos permanecem `PENDING_PRIMARY_SOURCE`
por decisão explícita — ver `docs/FACTORS_SOURCE_DOSSIER.md`.
