# METHODOLOGY TESTING STANDARD

## Categorias de caso de teste

`method_test_cases.test_type`:

- `APPLICABILITY` — o método se aplica (ou não) a um cenário descrito.
- `REQUIREMENT` — requisito de dados/amostra/evidência é exigido corretamente.
- `REJECTION` — cenário que o método deve recusar.
- `DIAGNOSTIC` — diagnóstico de qualidade produz o estado esperado.
- `DOCUMENTATION` — saída documental obrigatória está declarada.

Cada caso declara entrada descritiva, resultado esperado e fundamento. Casos são
**especificação de comportamento**, não execução de cálculo: nenhum caso produz
valor avaliatório.

## Conformidade

`method_compliance_assessments` registra a avaliação de aderência de uma
especificação aos requisitos declarados. Avaliação é humana e fundamentada.

## Suítes executáveis do repositório

| Suíte | Comando | Cobertura | Resultado |
| --- | --- | --- | --- |
| Segurança (negativa) | `bun run test:security` | invariantes de banco, imutabilidade, RLS, GRANT | 84/84 |
| Mercado | `bun run test:market` | comparáveis, preços, duplicidade | 33/33 |
| Pesquisa | `bun run test:research` | motor de pesquisa, candidatos, promoção | 28/28 |
| Inteligência de mercado | `bun run test:market-intelligence` | clusters, snapshots, prontidão | 81/81 |
| Governança metodológica | `bun run test:methodology` | fontes, especificações, RBAC, selo, auditoria | 161/161 |

A suíte metodológica cria apenas fixtures `TEST_ONLY` com sufixo único por
execução, nunca métodos reais, e prova: fluxo legítimo completo, separação de
funções, recusa de auto-aprovação, imutabilidade pós-aprovação, estabilidade do
hash, recusa de expressão executável, isolamento cross-tenant fail-closed,
`METADATA_ONLY` sem verificação de conteúdo e atomicidade da auditoria.

## Regra permanente

Nova invariante exige novo teste negativo provando que o bypass falha. Sem
teste, a invariante é considerada inexistente.
