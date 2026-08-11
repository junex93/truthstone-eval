# RESEARCH ENGINE — Property Intelligence Research (Fase 4)

O motor de pesquisa é a primeira camada de IA do produto. Ele **descobre
candidatos**; nunca produz fato. Nada que a IA escreve chega ao acervo de
mercado sem trecho conferido pelo sistema e verificação humana registrada.

## 1. Máquina de estados persistida

Cada rodada é uma linha em `property_research_runs`. Nenhuma etapa é um fluxo
síncrono longo: cada ação é curta, idempotente e retomável.

```text
DRAFT → PLANNING → PLAN_READY → SEARCHING → RESULTS_READY
      → CAPTURING → EXTRACTING → REVIEW_REQUIRED → COMPLETED
                                  ↘ FAILED / CANCELLED
```

| Etapa | Server function | Efeito persistido |
|---|---|---|
| Criar rodada | `createResearchRun` | run + `research_context_snapshots` |
| Planejar consultas | `generateResearchPlan` | `research_queries` (`PROPOSED`) |
| Editar/descartar consulta | `upsertResearchQuery`, `discardResearchQuery` | consulta versionada |
| Executar consulta | `executeResearchQuery` | `research_search_results` |
| Selecionar fonte | `selectResearchResult` | `selection_status` |
| Capturar fonte | `captureResearchSource` | `evidence_sources` + `evidence_artifacts` (SHA-256 no servidor) |
| Extrair | `extractResearchSource` | `evidence_extractions`, `research_entity_candidates`, `evidence_fields` (`EXTRACTED`) |
| Verificar campo | RPC `verify_evidence_field` | `VERIFIED` + auditoria |
| Promover | RPC `promote_research_candidate` | `market_properties` + `market_observations` |

Idempotência: uma fonte já `CAPTURED` não é recapturada e um artefato já extraído
não é reextraído — artefato e extração são imutáveis.

## 2. Contexto enviado ao provedor

`buildContextFacts` envia apenas fatos **verificados** do caso, cada um com
`factId` rastreável. O provedor não recebe token, chave, id de organização, dado
de outro caso nem acesso a banco, storage ou RPC.

## 3. Camada de provedor

`src/lib/research/provider.ts` define quatro unidades de trabalho
(`generateQueryPlan`, `search`, `fetch`, `extract`). Duas implementações:

- `AnthropicResearchProvider` — busca e fetch server-side do provedor, saída
  estruturada na extração;
- `FixtureResearchProvider` — determinístico, offline, usado em testes e no modo
  de demonstração.

`resolveProvider()` lê configuração dentro do handler e **não tem fallback
silencioso**: sem `ANTHROPIC_API_KEY` a operação falha, a menos que
`RESEARCH_PROVIDER=FIXTURE` seja declarado explicitamente.

Toda invocação grava `ai_runs` com modelo, versão de prompt, versão de
ferramenta, `request_id`, tokens e payload bruto.

## 4. Fonte é o que a ferramenta retornou

Somente URLs vindas do bloco de resultado da ferramenta se tornam
`research_search_results`. URL citada na prosa do modelo é registrada como
`rejectedProseUrls` e nunca é capturável. A captura recalcula o SHA-256 lendo os
bytes do bucket privado — hash enviado pelo cliente nunca é aceito.

## 5. Gate determinístico (`support-check.ts`)

O sistema, não o modelo, decide se um valor tem suporte:

1. o trecho citado precisa existir no conteúdo capturado (exato ou normalizado);
2. o número precisa aparecer dentro do trecho citado;
3. o número declarado pela IA é comparado ao parser determinístico — divergência
   vira `DIVERGENT` + `NUMERIC_CONFLICT_WITH_PARSER`;
4. campo fora da allowlist fechada é descartado com registro;
5. valores divergentes na mesma fonte são preservados como `DIVERGENT`;
6. preço transacionado apoiado em linguagem de preço pedido é reprovado
   (`TRANSACTION_CLAIM_FROM_ASKING_PRICE`);
7. padrões de instrução no conteúdo geram `ADVERSARIAL_CONTENT_SUSPECTED`.

Ausência declarada gera estado explícito (`NOT_FOUND`, `NOT_VERIFIABLE`), nunca
zero. Campo com `support_check_status = FAILED` não pode ser verificado — o
trigger `guard_support_check_before_verification` impõe isso no banco.

## 6. Promoção ao acervo

`promote_research_candidate` (SECURITY DEFINER) exige papel de escrita, campos
`VERIFIED`, ausência de conferência reprovada, e recusa transformar oferta em
transação. Grava imóvel de mercado, observação, observações de atributo com
linhagem campo a campo, primeira leitura de preço e evento de auditoria.

## 7. Orçamento e limites

`RESEARCH_BUDGET_LIMITS` define tetos de servidor por rodada (buscas, fontes,
capturas, extrações) e limites por hora por usuário e por organização. Todo
consumo é registrado em `research_usage_events`, cuja escrita pelo cliente é
negada.

## 8. Testes

- `bun run tests/functional/research-flow.ts` — gate determinístico offline
  (fabricação de trecho, número ausente, conflito numérico, campo fora da
  allowlist, injeção de prompt, oferta ≠ transação, URL inventada) e invariantes
  de banco das tabelas de pesquisa.
- `bun run tests/security/negative-tests.ts` — suíte negativa geral.

## 9. Limitações declaradas

- Resolução de outcome, cálculo de valor, tratamento por fatores e inferência
  estatística estão fora desta fase.
- Fontes com paywall ou bloqueio de robôs não são capturáveis; a falha é
  registrada, não contornada.
- O modo `FIXTURE` é para demonstração e teste; não representa dado de mercado.
