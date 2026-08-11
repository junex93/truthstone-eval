# AI GOVERNANCE

Regra permanente: **IA produz candidato, humano produz fato.** Nenhuma saída de
modelo entra no acervo sem fonte identificada, trecho conferido pelo sistema e
verificação humana registrada em auditoria.

## 1. Fronteiras da IA

A IA pode:
- propor consultas de busca;
- operar busca e leitura de página pelo provedor;
- propor campos extraídos de um conteúdo já capturado.

A IA não pode:
- gravar em qualquer tabela de domínio;
- chamar RPC, storage ou Data API;
- verificar, rejeitar, congelar, promover ou transicionar status;
- decidir comparabilidade, adotar fato canônico ou resolver divergência;
- receber dado de outro caso, de outra organização, token ou segredo.

## 2. Estados de valor

| Estado | Significado |
|---|---|
| `PRESENT` | valor com trecho conferido no conteúdo capturado |
| `NOT_FOUND` | a fonte não traz o dado |
| `NOT_INFORMED` | a fonte declara não informar |
| `NOT_VERIFIABLE` | suporte visual, ambíguo ou reprovado na conferência |
| `DIVERGENT` | leituras conflitantes preservadas para decisão humana |
| `PENDING_VALIDATION` | aguarda revisão |

Ausência nunca é convertida em zero. Completude nunca é tratada como confiança.

## 3. Duas verdades separadas

- `ai_support_status` — o que o modelo **alegou**;
- `support_check_status` — o que o sistema **provou** relendo o conteúdo.

A segunda é a autoridade. Divergência entre as duas é visível na interface e
registrada em `research_extraction_issues`.

## 4. Rastreabilidade de cada chamada

`ai_runs` registra provedor, modelo, versão de prompt, versão da ferramenta,
`request_id`, tokens, status e payload bruto sem segredos.
`research_usage_events` registra consumo para orçamento e limite por hora.
Nenhuma dessas tabelas é escrita pelo cliente.

## 5. Prompts

Prompts são versionados em `src/lib/research/prompts.ts`. A versão usada é
persistida junto com a extração; alteração de prompt não reescreve histórico —
gera nova extração.

## 6. Modelos e provedores

O domínio depende da interface `ResearchProvider`, nunca de SDK de fornecedor.
Trocar modelo ou provedor não altera regra de domínio. Não há fallback silencioso
de provedor real para fixture: o modo determinístico precisa ser declarado.

## 7. Custo e abuso

Tetos por rodada e limites por usuário/organização são impostos no servidor antes
da chamada. Estouro de orçamento interrompe a etapa e é auditado; nunca é
silenciosamente ampliado pelo cliente.
