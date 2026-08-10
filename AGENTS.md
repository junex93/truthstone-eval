<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md — Regras permanentes do projeto

Plataforma de **inteligência pericial e avaliação imobiliária multimetodológica**.
Leia `docs/PRODUCT_CONSTITUTION.md` antes de qualquer alteração. As regras abaixo
são permanentes e valem para qualquer agente ou pessoa que edite este repositório.

## 1. Regra anti-alucinação (inviolável)

- Nenhum dado factual entra no acervo sem fonte identificada e verificação humana
  registrada.
- IA, OCR e parsers só produzem **candidatos** (`EXTRACTED` / `PENDING_REVIEW`).
- Nunca inventar valor ausente: usar `field_state`
  (`NOT_FOUND`, `NOT_INFORMED`, `NOT_VERIFIABLE`, `DIVERGENT`, `PENDING_VALIDATION`).
- Nunca gerar número avaliatório sem base em dataset congelado.

## 2. Segurança de banco, não de interface

- Toda invariante nova precisa de imposição no PostgreSQL (GRANT, RLS, trigger ou
  RPC). Regra que só existe no React é considerada inexistente.
- Nunca conceder GRANT de UPDATE em `evidence_fields` ou `dataset_versions`, nem
  qualquer escrita em `audit_log`, `evidence_reviews`,
  `evidence_field_revisions`, `dataset_item_snapshots`.
- Nunca dar acesso de `anon` a tabelas de domínio ou às RPCs oficiais.
- Toda nova RPC `SECURITY DEFINER`: `search_path = public`, autorização interna
  explícita e **nunca** expor `set_config` do GUC `valuation.privileged_op`.

## 3. Operações oficiais

Verificar, rejeitar, revisar, congelar e transicionar status **só** por RPC:
`verify_evidence_field`, `reject_evidence_field`, `revise_evidence_field`,
`freeze_dataset`, `transition_case_status`. Não criar caminho alternativo em
server function nem em SQL de aplicação.

## 4. Imutabilidade

- Artefato bruto, extração concluída, revisões, auditoria e snapshots: sem edição,
  sem delete.
- Correção se faz por **nova versão** (extração, revisão de campo ou dataset).
- Dataset congelado nunca é reaberto.

## 5. Auditoria

Toda mudança de estado crítica grava evento na **mesma transação**, com autor
derivado do token (nunca do payload) e justificativa quando exigida.

## 6. Papéis

Papel vive em `organization_members` (nunca em `profiles`). Separação: VALUER
produz, REVIEWER valida. Nunca permitir auto-alteração de papel. Sempre manter ao
menos um OWNER ativo.

## 7. Multi-tenancy

`organization_id` obrigatório e imutável em toda tabela de domínio. Novos
relacionamentos usam FK composta `(organization_id, id)`. Nunca cruzar dados entre
casos (`valuation_case_id`) em datasets.

## 8. Storage

Buckets privados. Path canônico `<organization_id>/<valuation_case_id>/<arquivo>`.
Hash SHA-256 sempre calculado no servidor lendo os bytes do bucket; hash enviado
pelo cliente nunca é aceito.

## 9. Engenharia

- TypeScript estrito; sem `any` em contratos de domínio.
- Zod compartilhado entre cliente e servidor (`src/lib/validation/schemas.ts`).
- Vocabulário único em `src/lib/domain/constants.ts` — não duplicar strings de
  enum em componentes.
- Server functions em `*.functions.ts`; helpers exclusivos de servidor em
  `*.server.ts`. Arquivo com `createServerFn` é wrapper fino.
- Sem `child_process`, `sharp` ou binário nativo (runtime Worker).
- Sem cores hardcoded: usar os tokens semânticos de `src/styles.css`.
- Rotas em `src/routes` (TanStack Router). Nunca usar react-router-dom.

## 10. Mudanças de schema e testes

- Toda mudança de schema entra como migração versionada, com GRANT explícito para
  cada tabela nova em `public`.
- Após qualquer alteração de segurança: rodar
  `bun run tests/security/negative-tests.ts` e o advisor de segurança; registrar o
  resultado em `docs/CHANGELOG.md`.
- Novas invariantes exigem novo teste negativo provando que o bypass falha.

## 11. Escopo

Não implementar tratamento por fatores, inferência estatística, AVM, ML, SHAP,
convergência, laudo automático, agentes de pesquisa ou RAG sem pedido explícito —
e somente sobre datasets congelados.

## 12-A. Regras permanentes — mercado e comparáveis (Fase 3)

- Nunca interpretar um anúncio `REMOVED` como vendido sem evidência de
  transação (`CLOSED_SALE`/`CLOSED_RENT`) com sua própria fonte.
- Nunca tratar múltiplos anúncios do mesmo imóvel como comparáveis
  independentes sem revisão de duplicidade (`resolve_property_match`).
- Nunca sobrescrever preço pedido histórico: toda alteração passa por
  `record_price_observation`, que preserva a leitura anterior.
- Nunca deletar um comparável excluído: `EXCLUDED != DELETED`, o registro e
  seu histórico de decisão permanecem no acervo.
- Nunca converter um atributo com `knowledge_state = UNKNOWN` (ou ausente) em
  zero ou em qualquer valor numérico neutro.
- Nunca tratar completude de dados como confiança (`COMPLETENESS !=
  CONFIDENCE`).
- Nunca tratar preço pedido como preço transacionado: `asking_*` e
  `transaction_*` são sempre evidências e colunas distintas.
- Nunca resolver automaticamente atributos divergentes entre observações:
  divergência é preservada até haver adoção humana.
- Fatos canônicos exigem adoção humana autorizada
  (`adopt_canonical_fact`, papel `can_review`, justificativa registrada);
  nenhum outro caminho pode gravar em `property_canonical_facts`.

## 12. Documentação

Alterou comportamento? Atualize `docs/` na mesma entrega (`CHANGELOG.md` sempre;
`DECISIONS.md` para escolha arquitetural; `THREAT_MODEL.md` e `SECURITY.md` para
mudança de segurança). Limitações são declaradas, nunca omitidas.
