# DATA GOVERNANCE

## Multi-tenancy

Unidade de isolamento: `organizations`. Todo registro de domínio carrega
`organization_id`. Regras:

- `organization_id` é **imutável** após a criação (trigger
  `prevent_org_migration` em casos, imóveis, fontes, artefatos, extrações,
  campos, datasets e execuções de IA);
- chaves estrangeiras **compostas** `(organization_id, id)` garantem que um filho
  jamais aponte para um pai de outra organização — a consistência não depende de
  o código escrever o `organization_id` correto;
- `organization_members` define papel e `status` (ACTIVE, SUSPENDED, REMOVED);
- a organização deve manter sempre ao menos um `OWNER` ativo.

## Máquina de estados do caso

Fonte única: RPC `transition_case_status` (banco), espelhada em
`src/lib/domain/constants.ts` apenas para a UI.

```
DRAFT               -> EVIDENCE_COLLECTION, ARCHIVED
EVIDENCE_COLLECTION -> DATA_REVIEW, DRAFT, ARCHIVED
DATA_REVIEW         -> EVIDENCE_COLLECTION, DATASET_FROZEN, ARCHIVED
DATASET_FROZEN      -> VALUATION, DATA_REVIEW, ARCHIVED
VALUATION           -> REVIEW, ARCHIVED
REVIEW              -> VALUATION, COMPLETED, ARCHIVED
COMPLETED           -> ARCHIVED
ARCHIVED            -> (terminal)
```

Regras adicionais impostas no banco:

- `UPDATE` direto de `status` é recusado (`guard_case_status`);
- entrar em `DATASET_FROZEN` exige ao menos um dataset efetivamente congelado no caso;
- `COMPLETED` exige `ADMIN` ou `OWNER`;
- retrocesso e arquivamento exigem justificativa técnica registrada (mín. 3 caracteres);
- `case_code` só pode mudar em `DRAFT`;
- o imóvel avaliando não pode ser alterado a partir de `DATASET_FROZEN` sem
  reversão formal de fase (`guard_property_mutability`).

## Ciclo de vida do dado

| Categoria | Regra |
| --- | --- |
| Artefato bruto | imutável, sem delete físico |
| Extração | proveniência imutável; correção por nova versão |
| Campo | edição rastreada; edição invalida verificação |
| Revisões | append-only, sem update/delete |
| Auditoria | append-only, sem update/delete, escrita só interna |
| Snapshot de dataset | append-only, sem update/delete |
| Dataset congelado | imutável; correção por nova versão |

## Retenção e exclusão

Não existe exclusão física de prova, decisão ou trilha. "Remover" um caso é
`ARCHIVED` com justificativa. Isso é uma decisão de produto (ADR-004 em
`docs/DECISIONS.md`) e tem consequência: apagar dados de um titular exige
procedimento administrativo específico, ainda **não implementado**.

## Registro de uso de IA

`ai_runs` guarda propósito, provedor, modelo, versão de modelo, versões de prompt
(sistema e tarefa), IDs de evidência de entrada, saída bruta, status e tempos.
Nenhuma saída de IA é dado factual: ela só entra no acervo como candidato sujeito
a verificação humana.
