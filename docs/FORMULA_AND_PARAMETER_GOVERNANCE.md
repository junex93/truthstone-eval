# FORMULA AND PARAMETER GOVERNANCE

## Fórmula é declaração, não código

`methodology_formulas.expression` guarda expressão **simbólica** documental. O
trigger `guard_methodology_formula` recusa qualquer coisa com aparência de
código executável (chamadas de função de linguagem hospedeira, `select`,
`import`, `eval`, atribuição imperativa, encadeamento de statements). O banco
não avalia fórmula; a plataforma não tem interpretador metodológico.

## Variáveis

Cada variável de fórmula (`methodology_formula_variables`) declara símbolo,
significado, unidade e vínculo ao dicionário de dados
(`methodology_data_dictionary`). Fórmula com variável não declarada é bloqueador
de completude — não é aviso silencioso.

## Parâmetros

`methodology_parameters` declara tipo, unidade, faixa admissível, valor de
referência e **fundamento**. Parâmetro sem faixa ou sem fundamento é bloqueador.
Nenhum parâmetro numérico de produção foi seedado: os valores de fatores e
modelos inferenciais permanecem ausentes por decisão explícita.

## Proveniência

Toda regra normativa exige localizador de fonte verificada. Regra de controle
interno é marcada `INTERNAL_CONTROL` e nunca se apresenta como exigência de
norma. `methodology_rules.normative_strength` separa o que a norma manda do que
a organização escolheu.

## Unidades

`methodology_units` é vocabulário fechado. Unidade desconhecida não é
convertida, inferida ou tratada como adimensional; `p_unit_unknown` mantém o
estado explícito de desconhecimento.

## Limite declarado

Esta camada descreve fórmulas. **Não** executa cálculo, não ajusta comparável,
não gera valor e não produz laudo.
