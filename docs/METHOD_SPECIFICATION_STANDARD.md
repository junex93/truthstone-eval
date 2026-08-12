# METHOD SPECIFICATION STANDARD

Uma especificação é a descrição **completa e versionada** de um método: o que
exige, como se comporta, onde se aplica e qual fundamento a sustenta.

## Ciclo de vida

```
DRAFT -> UNDER_REVIEW -> APPROVED
                    \-> REJECTED (retorna a DRAFT em nova versão)
APPROVED -> SUPERSEDED (por nova versão que a substitui)
```

- `DRAFT`: editável pelo produtor.
- `UNDER_REVIEW`: congelada para edição de conteúdo; só o revisor decide.
- `APPROVED`: imutável, com manifesto canônico e `specification_hash` SHA-256.
- `REJECTED`: imutável, com motivo escrito preservado.
- `SUPERSEDED`: histórico permanece; nunca é apagada.

Correção de especificação aprovada = **nova versão**, nunca edição.

## Seções obrigatórias (18)

1. Objetivo e escopo do método
2. Definições e vocabulário
3. Pressupostos e limitações
4. Condições de aplicabilidade
5. Requisitos de dados de entrada
6. Requisitos de amostra
7. Requisitos de evidência e proveniência
8. Tratamento de dados ausentes e divergentes
9. Procedimento metodológico
10. Fórmulas e variáveis simbólicas
11. Parâmetros e faixas admissíveis
12. Critérios de qualidade e diagnósticos
13. Critérios de rejeição e bloqueadores
14. Saídas e contratos de resultado
15. Requisitos de documentação e laudo
16. Fundamento normativo e citações
17. Controle de mudança e versionamento
18. Casos de teste e critérios de aceitação

`specification_completeness` avalia, de forma determinística: seções ausentes,
requisitos de fonte não atendidos, regras sem fundamento, fórmulas sem variáveis
declaradas e parâmetros sem faixa. O diagnóstico é reproduzível — mesma entrada,
mesma saída.

## Bloqueadores de submissão

Submissão é recusada quando há seção obrigatória ausente, regra normativa sem
localizador de fonte, fórmula sem variável mapeada ao dicionário de dados, ou
requisito de fonte declarado e não satisfeito.

## Selo de integridade

Na aprovação, o banco monta o manifesto canônico (ordenação estável de seções,
regras, fórmulas, variáveis, parâmetros, contratos e requisitos), calcula
SHA-256 e grava `specification_manifest` + `specification_hash`.
`verify_specification_integrity` recalcula e compara — o resultado é estável
entre execuções repetidas.

## Shells vazias

"Tratamento por fatores" e "Inferência estatística" existem apenas como
`valuation_methods` em estado conceitual com especificação `DRAFT` **vazia**.
Nenhuma fórmula operacional, nenhum parâmetro de produção, nenhum motor.
