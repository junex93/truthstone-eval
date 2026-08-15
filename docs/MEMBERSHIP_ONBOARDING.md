# Onboarding de membro — convite governado (fase 7H.1)

Este documento descreve o único caminho autorizado para adicionar uma pessoa real
a uma organização depois do bootstrap do primeiro OWNER.

## Estados do convite

```
INVITED ──aceite autenticado──> ACCEPTED  (membership ACTIVE criada)
   │
   ├──revogação por OWNER/ADMIN──> REVOKED
   └──prazo vencido + rotina de expiração──> EXPIRED
```

Convite enviado **não é** membro. `organization_members` só recebe linha
`status = ACTIVE` dentro da transação do aceite.

## Modelo

`public.organization_invitations`

| Campo | Papel |
| --- | --- |
| `organization_id` | tenant imutável do convite |
| `email` | e-mail normalizado (`lower(btrim(...))`, imposto por CHECK) |
| `invited_role` | papel aprovado; CHECK proíbe `OWNER` |
| `status` | `INVITED` / `ACCEPTED` / `EXPIRED` / `REVOKED` |
| `token_hash` | **apenas** o digest SHA-256 do token (CHECK de formato `[0-9a-f]{64}`) |
| `invited_by`, `invited_at`, `expires_at`, `send_count`, `last_sent_at` | emissão |
| `accepted_by`, `accepted_at` | consumo |
| `revoked_by`, `revoked_at`, `revoked_reason` | revogação |

Índice único parcial `uq_invitation_pending_per_email` garante **um** convite
pendente por (organização, e-mail): duplicidade silenciosa é impossível.

O token em texto puro **nunca** é persistido nem registrado em log. Ele é gerado
no servidor (32 bytes aleatórios), devolvido uma única vez ao ator autorizado e
descartado. Reenvio **rotaciona** o digest — o link anterior deixa de valer.

## Operações oficiais (RPC `SECURITY DEFINER`, `search_path = public`)

| RPC | Autorização interna |
| --- | --- |
| `create_organization_invitation` | OWNER/ADMIN **ACTIVE** da mesma organização; recusa `OWNER` como papel convidado |
| `resend_organization_invitation` | idem; só convite `INVITED`; rotaciona token |
| `revoke_organization_invitation` | idem; só convite `INVITED` |
| `expire_stale_invitations` | transiciona convites vencidos e audita |
| `inspect_organization_invitation` | leitura diagnóstica pelo convidado autenticado, sem revelar token |
| `accept_organization_invitation` | aceite atômico |

Nenhum `INSERT`/`UPDATE`/`DELETE` é concedido a `authenticated` na tabela: a Data
API só lê. Toda mutação passa pelas RPCs acima, que gravam auditoria na **mesma
transação** do ato.

## Validação do aceite (toda no banco)

1. token existe (busca por digest);
2. status é `INVITED` (não aceito, não revogado, não expirado);
3. `expires_at > now()` — caso contrário marca `EXPIRED` e recusa;
4. `lower(auth.jwt() ->> 'email')` **igual** ao e-mail convidado;
5. papel do convite ≠ `OWNER`;
6. o usuário ainda não possui vínculo com aquela organização;
7. cria `organization_members` com `role = invited_role`, `status = ACTIVE`.

O papel vem sempre da linha do convite. O convidado não envia papel: não existe
caminho em que `invite = REVIEWER` produza `membership = OWNER`.

## RLS

- `invitation_admin_read`: `is_org_admin(organization_id)` — OWNER/ADMIN veem os
  convites da própria organização.
- `invitation_invitee_read`: o convidado vê **apenas** o convite `INVITED`
  endereçado ao seu próprio e-mail autenticado.
- Nenhuma política concede leitura a outros tenants; `anon` não tem GRANT.

A projeção do servidor (`readInvitations`) exclui `token_hash` explicitamente.

## Proteções preservadas

- OWNER não altera o próprio papel (`guard_membership_changes`).
- A organização mantém ao menos um OWNER ativo.
- Vínculo de membro é imutável em `user_id` / `organization_id`.
- Bootstrap do primeiro OWNER inalterado.
- Remoção de membro **não** foi implementada nesta fase.

## Auditoria

`INVITE_CREATED`, `INVITE_SENT`, `INVITE_ACCEPTED`, `INVITE_REVOKED`,
`INVITE_EXPIRED` — com organização, ator derivado do token, entidade, e-mail
convidado, papel e desfecho. Nunca com token.

## Entrega do convite (limitação declarada)

O projeto **não possui domínio de e-mail configurado**, portanto o envio
automático da mensagem de convite está indisponível:
`BLOCKED_BY_EMAIL_CONFIGURATION`. O fluxo funciona integralmente com entrega
manual do link `/convite/<token>` pelo OWNER. Ao configurar um domínio de e-mail
para o projeto, o disparo automático pode ser plugado sobre a mesma RPC de
criação, sem alterar governança.

O convidado usa `/auth?convite=<token>` para entrar ou criar conta — os e-mails
de confirmação de cadastro seguem pelo remetente padrão da plataforma.

## Testes

`bun run tests/functional/organization-invitation-flow.ts` — 47/47 PASS.
Cobre criação, isolamento por tenant, aceite, integridade de papel, expiração,
revogação, reenvio com rotação de token, duplicidade, auditoria e ativação de
membership, além de provar que nenhum ato normativo é criado pelo onboarding.

## Continuidade do handoff (Fase 7H.2)

O convidado pode não ter conta. O ciclo real é: link do convite → criação de
conta → confirmação de e-mail (frequentemente em outra aba) → autenticação →
aceite. Duas peças garantem a continuidade sem afrouxar a segurança:

1. `src/lib/invite-intent.ts` guarda o token no `localStorage` do navegador com
   TTL de 7 dias. É contexto de navegação, não credencial de autorização: o
   banco revalida tudo no aceite.
2. `list_my_pending_invitations()` mostra ao usuário autenticado os convites
   pendentes endereçados ao seu e-mail, inclusive quando ele ainda não pertence
   a nenhuma organização — sem expor digest, token ou dados de outra pessoa.

Limitação declarada: coincidência de e-mail nunca cria vínculo. Sem o token do
convite, o aceite é impossível; o usuário precisa do link entregue pelo
administrador. A entrega do link permanece manual
(`BLOCKED_BY_EMAIL_CONFIGURATION`).

## Resolver único de onboarding (Fase 7H.4)

Toda tela que depende de organização passa pelo mesmo resolver
(`src/lib/onboarding-state.ts`), consumido por `useOnboardingState` e aplicado
via `OnboardingGate`:

| Estado | Condição | UI |
| --- | --- | --- |
| `AUTH_LOADING` | sessão/workspace ou convites ainda carregando | skeleton |
| `MEMBER` | membership ACTIVE | conteúdo normal da rota |
| `PENDING_INVITATION` | sem membership e ≥ 1 convite `INVITED` para o e-mail | painel do convite (org, papel, expiração) |
| `NO_ORGANIZATION` | sem membership e sem convite | criar organização / abrir link de convite |
| `ERROR` | falha ao resolver workspace | mensagem de erro |

Regras preservadas: o painel só oferece "continuar para o convite" quando o
token bruto está na intenção local; sem token o convidado é orientado a reabrir
o link original ou pedir reenvio. E-mail coincidente não gera membership; o
aceite é sempre ato humano explícito validado no banco.
