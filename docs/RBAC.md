# RBAC

## Papéis (`org_role`)

| Papel | Leitura | Criar/editar dados | Verificar/rejeitar evidência | Congelar dataset | Concluir caso | Gerir membros |
| --- | --- | --- | --- | --- | --- | --- |
| OWNER | sim | sim | sim | sim | sim | sim |
| ADMIN | sim | sim | sim | sim | sim | sim |
| VALUER | sim | sim | **não** | sim | não | não |
| REVIEWER | sim | não | sim | não | não | não |
| VIEWER | sim | não | não | não | não | não |

Separação de funções: quem produz o candidato (VALUER) não é quem valida
(REVIEWER). OWNER/ADMIN acumulam por necessidade operacional, mas cada ato fica
registrado com autor e justificativa.

## Funções de autorização no banco

- `is_org_member(org)` — vínculo ACTIVE.
- `has_org_role(org, roles[])` — base das demais.
- `can_write(org)` — OWNER, ADMIN, VALUER.
- `can_review(org)` — OWNER, ADMIN, REVIEWER.
- `is_org_admin(org)` — OWNER, ADMIN.
- `current_org_role(org)` — papel efetivo do usuário.

Todas são `STABLE SECURITY DEFINER` com `search_path = public`, para evitar
recursão de RLS. São chamadas pelas policies e pelas RPCs oficiais — nunca
confiam em valor enviado pelo cliente.

## Espelho no servidor de aplicação

`src/lib/workspace.server.ts` expõe `requireMembership`, `requireWriteAccess`,
`requireReviewAccess` e `requireAdminAccess`. Elas resolvem o papel **lendo o
banco** com o token do usuário; nenhum papel vem do corpo da requisição.

## Anti-escalação de privilégio

- Papel vive em `organization_members` (nunca em `profiles`).
- Um usuário não pode alterar o próprio papel (`guard_membership_changes`).
- O vínculo `(organization_id, user_id)` é imutável: trocar de organização exige
  remover e reconvidar.
- O último `OWNER` ativo não pode ser rebaixado nem removido.
- Somente OWNER/ADMIN podem convidar ou alterar papéis (RLS em
  `organization_members`).

## UI

A UI desabilita ações fora do papel apenas por clareza. Todos os caminhos
correspondentes foram testados negativamente contra a API direta —
ver `tests/security/negative-tests.ts`, seções 3 e 9.
