# FACTORS IMPLEMENTATION BLUEPRINT

Desenho do **futuro** motor de Tratamento por Fatores. Nada disto está
implementado; a Fase 7 entrega especificação, não cálculo.

## Pré-condições para começar a implementar

1. Especificação `APPROVED` e selada (SHA-256 do manifesto canônico).
2. Fórmulas e requisitos de amostra saindo de `PENDING_PRIMARY_SOURCE`.
3. Conjunto de parâmetros com valor, escopo, vigência e fonte verificada.
4. Casos de teste do catálogo `T-*` implementados e falhando pelos motivos certos.

## Contrato pretendido

```text
input  = dataset congelado (dataset_versions.status = FROZEN)
       + specification_id APROVADA
       + parameter_set com escopo e vigência compatíveis
output = valor por comparável + memória de cálculo + diagnósticos
       + manifesto de execução com SHA-256
```

Invariantes obrigatórias do futuro motor:

- Sem dataset congelado, não executa.
- Sem especificação aprovada e selada, não executa.
- Fator sem procedência, escopo ou vigência: recusa (não substitui por default).
- Input ausente: recusa com `MISSING_REQUIRED_INPUT` (não trata como zero).
- Preço pedido nunca é lido como transação.
- Execução grava `method_run` imutável com hash de entrada e saída, na mesma
  transação da auditoria.
- Reexecução com mesmas entradas produz saída idêntica (reprodutibilidade).

## Requisitos de teste já registrados

`T-UNSOURCED-FACTOR`, `T-WRONG-SCOPE`, `T-EXPIRED-PARAM`, `T-MISSING-INPUT`,
`T-AREA-SEMANTIC`, `T-OFFER-TRANSACTION`, `T-UNSOURCED-CONSTANT` e demais casos
de `method_test_cases` cobrindo UNIT, NUMERIC, BOUNDARY, NEGATIVE, COMPLIANCE,
REPRODUCIBILITY e AUDITABILITY.

## Limite declarado

`method_implementations` para este shell está vazio e o método permanece em
`SPECIFICATION_IN_PROGRESS`. A suíte
`tests/functional/factors-specification-governance.ts` prova que nenhum
componente de produção calcula valor homogeneizado, ajustado ou estimado.

## Confirmação — Fase 7B

Este documento permanece **BLUEPRINT ONLY**: nenhuma lógica executável, nenhum
fator, nenhuma fórmula, nenhum parâmetro numérico e nenhum motor de cálculo
foram introduzidos. Fatores e inferência seguem como shells em
`SPECIFICATION_IN_PROGRESS`.
