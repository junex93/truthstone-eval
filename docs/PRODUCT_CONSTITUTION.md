# PRODUCT CONSTITUTION

Documento normativo do produto. Nenhuma implementação futura pode violar estas
cláusulas. Em conflito entre conveniência de UX e integridade probatória,
**a integridade probatória prevalece**.

## Artigo 1 — Natureza do produto

A plataforma é um sistema de **inteligência pericial e avaliação imobiliária
multimetodológica**. Ela produz e preserva **cadeia de custódia da informação**.
Ela não é um AVM, não é um gerador de estimativas automáticas e não substitui o
julgamento do profissional responsável.

## Artigo 2 — Regra anti-alucinação (cláusula pétrea)

1. Nenhum dado factual entra no acervo avaliatório sem **fonte identificada** e
   **verificação humana registrada**.
2. A IA e qualquer parser atuam exclusivamente como **produtores de candidatos**
   (`validation_status = EXTRACTED | PENDING_REVIEW`).
3. É proibido inventar valor ausente. Ausência é modelada explicitamente:
   `NOT_FOUND`, `NOT_INFORMED`, `NOT_VERIFIABLE`, `DIVERGENT`,
   `PENDING_VALIDATION` (enum `field_state`).
4. Um campo só se torna `VERIFIED` com: revisor com papel autorizado,
   nota de fundamentação técnica e evidência de suporte (`source_excerpt` ou
   `source_locator`). Isso é imposto por trigger no banco
   (`enforce_field_validation_rules`) e pela RPC `verify_evidence_field`.

## Artigo 3 — Origem do dado

Todo dado factual tem linhagem completa e navegável:

```
evidence_source → evidence_artifact (bytes + SHA-256) → evidence_extraction
→ evidence_field (candidato) → decisão humana → dataset_item
→ dataset_item_snapshot (congelado)
```

Quebra de linhagem invalida o dado, não o processo.

## Artigo 4 — Imutabilidade

1. Artefato bruto é imutável (`protect_artifact_immutability`, `block_delete`).
2. Extração concluída é registro de proveniência: correção se faz por **nova
   versão de extração**, nunca por edição (`protect_extraction_immutability`).
3. Dataset congelado é imutável em conteúdo e em metadados de congelamento.
   Correção se faz por **nova versão de dataset**.
4. Trilha de auditoria e histórico de revisões são **append-only**.

## Artigo 5 — Verdade como estado explícito

Divergência entre fontes não é resolvida silenciosamente: é registrada
(`field_state = DIVERGENT`) e decidida por humano com justificativa.

## Artigo 6 — Segurança não é interface

Toda invariante é imposta no PostgreSQL (RLS + GRANT + trigger + RPC
`SECURITY DEFINER`). A UI é conveniência; o banco é a autoridade. Ver
`docs/SECURITY.md` e `tests/security/negative-tests.ts`.

## Artigo 7 — Auditabilidade

Toda operação crítica grava evento de auditoria **na mesma transação** da
mudança de estado. O cliente não pode fabricar, alterar ou apagar auditoria.

## Artigo 8 — Escopo temporal desta fase

Não implementado por decisão explícita (não por limitação): tratamento por
fatores, inferência estatística, AVM, machine learning, SHAP, análise de
convergência, geração automática de laudo, agentes de pesquisa e RAG. Estes
módulos só podem ser construídos **sobre datasets congelados**.
