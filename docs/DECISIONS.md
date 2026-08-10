# DECISIONS (ADR)

## ADR-001 — Invariantes no PostgreSQL, não na aplicação
**Status:** aceito.
**Contexto:** a Data API é alcançável diretamente com o token do usuário.
**Decisão:** cada invariante forense vive como GRANT + RLS + trigger + RPC.
**Consequência:** mais atrito para evoluir schema; qualquer cliente (inclusive
scripts) herda as garantias. Provado por testes negativos executáveis.

## ADR-002 — Operações críticas apenas por RPC `SECURITY DEFINER`
**Status:** aceito.
**Decisão:** verificação, rejeição, revisão, congelamento e transição de status
só existem como RPC; os GRANTs de UPDATE correspondentes foram revogados.
**Consequência:** o advisor de segurança acusa WARN de "definer executável por
autenticado" — aceito e documentado, pois é o mecanismo que evita dar privilégio
direto de tabela ao usuário.

## ADR-003 — Dataset congelado é snapshot de valores, não referência
**Status:** aceito.
**Contexto:** referenciar `evidence_field_id` não congela nada se o campo mudar.
**Decisão:** `dataset_item_snapshots` copia o estado integral no instante do
freeze e o manifesto canônico é hasheado com SHA-256.
**Consequência:** duplicação de dados; em troca, reprodutibilidade verificável.

## ADR-004 — Não existe exclusão física de prova, decisão ou trilha
**Status:** aceito.
**Decisão:** `block_delete` em auditoria, revisões, snapshots, artefatos e fontes;
"remover" um caso é arquivar com justificativa.
**Consequência:** conflito em aberto com direito de exclusão (LGPD); exige
procedimento administrativo específico, ainda não implementado.

## ADR-005 — Hash sempre calculado no servidor
**Status:** aceito.
**Decisão:** o servidor relê os bytes do bucket privado e calcula SHA-256;
`hash_computed_by = 'SERVER'`.
**Consequência:** custo de I/O por upload; hash do cliente jamais é prova.

## ADR-006 — Chaves estrangeiras compostas `(organization_id, id)`
**Status:** aceito.
**Decisão:** integridade de tenant garantida pelo banco, não pelo cuidado do
código ao preencher `organization_id`.
**Consequência:** índices únicos extras e migrações mais verbosas.

## ADR-007 — `organization_id` imutável
**Status:** aceito.
**Decisão:** trigger recusa alteração; transferência exige operação
administrativa formal (não implementada).

## ADR-008 — `EXECUTE` em `in_privileged_op()` para `authenticated`
**Status:** aceito com ressalva (descoberto pelos testes negativos).
**Contexto:** funções de trigger executam como o papel invocador; sem esse
`EXECUTE`, **toda** atualização legítima falhava com "permission denied for
function in_privileged_op".
**Decisão:** conceder `EXECUTE` a `authenticated` e revogar de `anon`.
**Ressalva:** a função apenas lê um GUC de transação, gravado somente dentro das
RPCs `SECURITY DEFINER`. Qualquer nova RPC exposta que permita `set_config`
quebraria a garantia — revisar em toda nova RPC.

## ADR-009 — Máquina de estados duplicada (banco + `constants.ts`)
**Status:** aceito.
**Decisão:** o banco é autoridade; a cópia no TypeScript existe só para a UI.
**Consequência:** risco de divergência; mudanças devem alterar os dois lados na
mesma entrega.

## ADR-010 — Métodos avaliatórios fora desta fase
**Status:** aceito.
**Decisão:** fatores, inferência estatística, AVM, ML, SHAP, convergência, laudo
automático, agentes e RAG só serão construídos sobre datasets congelados, após o
hardening da base factual.
