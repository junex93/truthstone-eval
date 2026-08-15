# METHODOLOGY SOURCE GOVERNANCE

Três coisas distintas que nunca se confundem:

| Conceito | O que é | O que autoriza |
| --- | --- | --- |
| **Metadados** | identificação da fonte (emissor, título, versão, ano, autoridade) | citar a existência da norma |
| **Conteúdo** | texto acessível por base legítima registrada | verificar aderência textual |
| **Localizador** | ponteiro preciso (cláusula, seção, página, tabela, figura) | ancorar uma regra a um trecho |

## Tipos de verificação

- `METADATA_VERIFIED` — identificação conferida. Permitida em `METADATA_ONLY`.
- `CONTENT_VERIFIED` — texto conferido. **Recusada** sem base de acesso.
- `LOCATOR_VERIFIED` — ponteiro conferido contra o documento.

Toda verificação exige `can_review`, justificativa e passa por
`verify_methodology_source`, que grava auditoria na mesma transação. Verificação
é append-only: não se desfaz, corrige-se com nova verificação.

## Linhagem organizacional

Triggers `SECURITY DEFINER` com comportamento **fail-closed**:

- `guard_methodology_source_artifact` — fonte não vincula artefato de outra org.
- `guard_methodology_locator_artifact` — localizador não cita arquivo de outra org.
- `guard_specification_child` — seção, regra, fórmula, variável, parâmetro,
  contrato, requisito e caso de teste só existem sob especificação da mesma org.
- `guard_rule_source` — vínculo regra-fonte respeita escopo e o localizador
  pertence à fonte citada.
- `guard_source_conflict_insert` — conflito só entre fontes do mesmo escopo ou globais.
- `guard_methodology_parent_immutable` — o pai (`organization_id`, spec, rule)
  nunca muda depois de criado.

Se o registro-pai não for encontrado — inclusive por invisibilidade de RLS — a
operação é **recusada**, não ignorada.

## Antipadrões proibidos

- Transcrever norma paga para o banco.
- Registrar citação literal sob `METADATA_ONLY`.
- Deduzir conteúdo normativo a partir de resumo, ementa ou memória de modelo.
- Usar IA para verificar fonte ou interpretar cláusula.

## Segregação humana de revisão (Fase 7G)

Verificar fonte não é aprovar norma. Os atos são distintos e cumulativos:
`METADATA_VERIFIED` → `CONTENT_VERIFIED` → `LOCATOR_VERIFIED` →
`CLAIM_ACCEPTED` → `METHOD_RULE_APPROVED` → `SPEC_APPROVED`. Nenhum degrau
implica o seguinte, e a interface apresenta essa escada literalmente.

Regras permanentes:

- Ato profissional exige pessoa real com papel de revisão (`OWNER`, `ADMIN` ou
  `REVIEWER`). `service_role`, fixture, IA, conta de sistema e conta de teste
  nunca ocupam esse papel em produção.
- Quem propõe claim candidata não pode aceitá-la: recusa imposta em
  `review_methodology_claim`.
- Com um único membro ativo, o lote de revisão de fonte primária permanece
  `BLOCKED_BY_HUMAN_REVIEWER` e os temas permanecem `PENDING_PRIMARY_SOURCE`.
- IA pode sugerir localizador e redação candidata; IA não verifica e não recebe
  autoria. Proveniência de descoberta é registrada separadamente da autoria.
