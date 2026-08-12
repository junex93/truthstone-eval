# METHODOLOGY CHANGE CONTROL

## Versionamento

Especificação é identificada por `(valuation_method_id, version)`. Versão
aprovada é imutável. Mudança gera nova versão que aponta
`supersedes_specification_id` para a anterior; a anterior passa a `SUPERSEDED` e
permanece consultável com seu manifesto e hash originais.

## Pedido de mudança

`methodology_change_requests` registra: tipo de mudança, motivação, impacto
esperado, fonte que a justifica e estado do pedido. Mudança normativa exige
localizador de fonte verificada; mudança de controle interno exige justificativa
organizacional.

## Crosswalk

`methodology_crosswalks` relaciona regras entre fontes distintas
(`EQUIVALENT`, `STRICTER`, `WEAKER`, `NO_EQUIVALENT`). Relação é declaração
humana com fundamento, nunca inferência automática por semelhança de texto.

## Regras permanentes

- Especificação aprovada nunca é editada nem apagada.
- Rejeição preserva motivo escrito e não remove a versão.
- Supersessão não reescreve histórico: o hash antigo continua verificável.
- Nenhuma mudança de metodologia altera dataset congelado já existente.
- Reaprovar exige novo ciclo completo: completude, submissão, revisor distinto.
