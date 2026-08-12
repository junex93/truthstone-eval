# NORMATIVE REGISTRY

Registro de fontes metodológicas. Uma fonte é o **objeto documental**, não o
texto: registrá-la nunca implica possuí-la ou reproduzi-la.

## Tipos de fonte

| Tipo | Exemplo | Autoridade típica |
| --- | --- | --- |
| `STANDARD` | ABNT NBR 14653 (partes) | `MANDATORY_LOCAL` |
| `INTERNATIONAL_STANDARD` | IVS | `INTERNATIONAL_REFERENCE` |
| `PROFESSIONAL_GUIDANCE` | RICS Red Book | `PROFESSIONAL_GUIDANCE` |
| `REGULATION` | resolução COFECI/CRECI | `MANDATORY_LOCAL` |
| `TECHNICAL_LITERATURE` | livro, artigo revisado | `ACADEMIC_REFERENCE` |
| `INTERNAL_POLICY` | política da organização | `INTERNAL_CONTROL` |

## Base de acesso (`access_status`)

- `METADATA_ONLY` — só a identificação existe no acervo. **Não** pode receber
  verificação de conteúdo nem sustentar citação literal.
- `LICENSED_COPY` — cópia licenciada disponível, com artefato registrado.
- `PUBLIC_DOCUMENT` — documento de acesso público.
- `NOT_ACCESSIBLE` — conhecida e inacessível; declarada como limitação.

Regra permanente: **norma paga entra como `METADATA_ONLY`** até haver base
legítima registrada. O banco recusa verificação de conteúdo nesse estado.

## Seeds oficiais

ABNT NBR 14653 (partes 1 e 2), IVS, COFECI e RICS entram como `METADATA_ONLY`,
globais (`organization_id` nulo), sem transcrição de texto. São âncoras de
citação, não conteúdo normativo copiado.

## Conflitos entre fontes

Divergência entre duas fontes é registrada em `methodology_source_conflicts` e
**preservada** até resolução humana por `resolve_methodology_source_conflict`,
que exige fundamento escrito e grava auditoria. Não existe resolução automática
por precedência de autoridade.

## Limitações declaradas

- Metadados de norma paga não permitem verificação de aderência textual.
- Nenhuma fonte é interpretada por IA; IA nunca cria, verifica ou aprova fonte.
- Batch 01 de revisão (T01/T04/T07) fechou como `BLOCKED_BY_USER_ARTIFACT`:
  NBR 14653-1 e -2 sem artefato, sem conteúdo verificado e sem localizador.
