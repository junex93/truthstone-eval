-- FASE 7B — Verificação de fontes e reclassificação de regras (MCDDM Fatores).
-- Nenhum fator, fórmula, tabela, coeficiente ou limiar é criado.

-- 1) Inventário bibliográfico (SOMENTE METADADOS — nenhum conteúdo verificado).
insert into public.methodology_sources
  (id, organization_id, title, short_title, source_type, issuing_body, edition, publication_year,
   jurisdiction, jurisdiction_detail, language, identifier, external_url, access_status,
   authority_level, status, notes)
values
  ('11111111-0000-4000-8000-000000000010', null,
   'IBAPE — Publicações e normas técnicas de avaliações e perícias de engenharia', 'IBAPE',
   'PROFESSIONAL_GUIDANCE', 'IBAPE — Instituto Brasileiro de Avaliações e Perícias de Engenharia',
   null, null, 'BRAZIL', 'Brasil', 'pt-BR', null, null, 'METADATA_ONLY',
   'AUTHORITATIVE_GUIDANCE', 'PENDING_METADATA_REVIEW',
   'Registro bibliográfico de orientação profissional. Edição, ano e conteúdo NÃO verificados. Não sustenta exigência normativa nem parâmetro numérico.'),
  ('11111111-0000-4000-8000-000000000011', null,
   'COBREAP — Trabalhos técnicos do Congresso Brasileiro de Engenharia de Avaliações e Perícias', 'COBREAP',
   'TECHNICAL_ARTICLE', 'IBAPE / COBREAP', null, null, 'BRAZIL', 'Brasil', 'pt-BR', null, null,
   'METADATA_ONLY', 'ESTABLISHED_TECHNICAL_LITERATURE', 'PENDING_METADATA_REVIEW',
   'Registro bibliográfico coletivo. Cada trabalho exigirá entrada própria, artefato e verificação humana antes de qualquer claim.'),
  ('11111111-0000-4000-8000-000000000012', null,
   'DANTAS, Rubens Alves — Engenharia de Avaliações: uma introdução à metodologia científica', 'Dantas',
   'BOOK', 'Autor / editora (a confirmar)', null, null, 'BRAZIL', 'Brasil', 'pt-BR', null, null,
   'METADATA_ONLY', 'ESTABLISHED_TECHNICAL_LITERATURE', 'PENDING_METADATA_REVIEW',
   'Obra protegida: apenas referência bibliográfica. Conteúdo não incorporado. Literatura técnica nunca é elevada a PRIMARY_NORMATIVE.'),
  ('11111111-0000-4000-8000-000000000013', null,
   'ABUNAHMAN, Sérgio Antônio — Curso Básico de Engenharia Legal e de Avaliações', 'Abunahman',
   'BOOK', 'Autor / editora (a confirmar)', null, null, 'BRAZIL', 'Brasil', 'pt-BR', null, null,
   'METADATA_ONLY', 'ESTABLISHED_TECHNICAL_LITERATURE', 'PENDING_METADATA_REVIEW',
   'Obra protegida: apenas referência bibliográfica. Conteúdo não incorporado.'),
  ('11111111-0000-4000-8000-000000000014', null,
   'FIKER, José — Manual de Avaliações e Perícias em Imóveis Urbanos', 'Fiker',
   'BOOK', 'Autor / editora (a confirmar)', null, null, 'BRAZIL', 'Brasil', 'pt-BR', null, null,
   'METADATA_ONLY', 'ESTABLISHED_TECHNICAL_LITERATURE', 'PENDING_METADATA_REVIEW',
   'Obra protegida: apenas referência bibliográfica. Conteúdo não incorporado.')
on conflict (id) do nothing;

-- 2) TOPIC MAP metodológico (T01..T32) como requisitos de fonte explícitos.
insert into public.method_specification_source_requirements
  (organization_id, method_specification_id, requirement_code, description, is_satisfied, notes)
select null, '33333333-0000-4000-8000-000000000001', t.code, t.descr, false, t.note
from (values
  ('T01_DEFINITION_MCDDM','Definição do método comparativo direto de dados de mercado','PENDING_PRIMARY_SOURCE: ABNT NBR 14653-1/-2 em METADATA_ONLY.'),
  ('T02_FACTOR_TREATMENT_POSITION','Posição do tratamento por fatores dentro do MCDDM','PENDING_PRIMARY_SOURCE.'),
  ('T03_PURPOSE','Finalidade declarada do tratamento por fatores','CANDIDATE: descrição interna sem claim normativa.'),
  ('T04_APPLICABILITY','Condições de aplicabilidade','PENDING_PRIMARY_SOURCE para condições normativas; controles internos existem separadamente.'),
  ('T05_NON_APPLICABILITY','Condições de não aplicabilidade','PENDING_PRIMARY_SOURCE.'),
  ('T06_MARKET_DATA_REQUIREMENTS','Requisitos de dados de mercado','PENDING_PRIMARY_SOURCE.'),
  ('T07_SAMPLE_REQUIREMENTS','Requisitos de amostra (quantidade mínima, composição)','PENDING_PRIMARY_SOURCE: nenhum mínimo amostral pode ser inventado.'),
  ('T08_SIMILARITY','Critério de semelhança entre avaliando e referências','PENDING_PRIMARY_SOURCE.'),
  ('T09_RELEVANT_VARIABLES','Variáveis relevantes','CANDIDATE: dicionário de dados interno mapeia conceitos, sem imposição normativa.'),
  ('T10_ACCEPTABLE_FACTOR_ORIGIN','Origem aceitável de fatores','PENDING_PRIMARY_SOURCE.'),
  ('T11_FACTOR_DERIVATION','Derivação de fatores','PENDING_PRIMARY_SOURCE / TECHNICAL_RESEARCH_REQUIRED.'),
  ('T12_REFERENCE_PARADIGM','Referência/paradigma','PENDING_PRIMARY_SOURCE.'),
  ('T13_APPLICATION_EXPRESSION','Expressão de aplicação dos fatores','PENDING_PRIMARY_SOURCE: nenhuma fórmula registrada.'),
  ('T14_FACTOR_COMBINATION','Combinação de fatores (GATE CRÍTICO)','PENDING_PRIMARY_SOURCE: combinação não pode ser inferida matematicamente.'),
  ('T15_APPLICATION_LIMITS','Limites de aplicação dos fatores','PENDING_PRIMARY_SOURCE: nenhum intervalo admissível registrado.'),
  ('T16_ASKING_DATA','Tratamento de dados de oferta','PENDING_PRIMARY_SOURCE.'),
  ('T17_TRANSACTION_DATA','Tratamento de dados de transação','PENDING_PRIMARY_SOURCE.'),
  ('T18_ASKING_VS_TRANSACTION','Distinção oferta vs transação','CANDIDATE: distinção imposta internamente como controle de integridade.'),
  ('T19_HOMOGENIZATION','Homogeneização: conceito, insumos e limites','PENDING_PRIMARY_SOURCE: sem cálculo implementado.'),
  ('T20_UNIT_VALUES','Valores unitários e semântica de área','CANDIDATE: semântica interna exata; base normativa pendente.'),
  ('T21_HOMOGENIZED_RESULTS','Tratamento dos resultados homogeneizados','PENDING_PRIMARY_SOURCE.'),
  ('T22_EXTREME_OBSERVATIONS','Observações extremas/discrepantes','PENDING_PRIMARY_SOURCE: nenhum critério estatístico definido.'),
  ('T23_EXCLUSIONS','Exclusão de elementos amostrais','CANDIDATE: exclusão preserva histórico por controle interno.'),
  ('T24_FUNDAMENTATION','Grau de fundamentação','PENDING_PRIMARY_SOURCE_ACCESS: nenhum critério ou pontuação registrado.'),
  ('T25_PRECISION','Grau de precisão','PENDING_PRIMARY_SOURCE_ACCESS.'),
  ('T26_ARBITRATION_FIELD','Campo de arbítrio','PENDING_PRIMARY_SOURCE_ACCESS: nenhum limite percentual registrado.'),
  ('T27_EXTRAPOLATION','Extrapolação','PENDING_PRIMARY_SOURCE_ACCESS.'),
  ('T28_CALCULATION_PRESENTATION','Apresentação de memória de cálculo','PENDING_PRIMARY_SOURCE.'),
  ('T29_SOURCE_DOCUMENTATION','Documentação de fontes dos dados','CANDIDATE: exigido internamente pelo motor de evidência.'),
  ('T30_PROFESSIONAL_JUSTIFICATION','Justificativa profissional','CANDIDATE: exigido internamente em decisões humanas.'),
  ('T31_REPORTING_REQUIREMENTS','Requisitos de relatório','CANDIDATE: controles internos de relato; exigências normativas pendentes.'),
  ('T32_KNOWN_LIMITATIONS','Limitações conhecidas do método','PENDING_PRIMARY_SOURCE / literatura técnica não verificada.')
) as t(code, descr, note)
on conflict do nothing;

-- 3) Reclassificação rastreável: vínculo BACKGROUND (nunca DIRECT_*) entre controle
--    interno e o tema externo cuja fonte primária permanece inacessível.
insert into public.methodology_rule_sources
  (organization_id, rule_id, source_id, relationship_type, interpretation_notes)
select null, r.id, m.source_id::uuid, 'BACKGROUND'::public.methodology_source_relationship, m.note
from (values
  ('FAC-A01','11111111-0000-4000-8000-000000000003','Tema externo correlato: requisitos de dados/amostra (T06/T07). Esta regra é CONTROLE INTERNO da plataforma, não exigência ABNT. Fonte primária em METADATA_ONLY: claim normativa pendente.'),
  ('FAC-A02','11111111-0000-4000-8000-000000000003','Tema externo correlato: valores unitários e semântica de área (T20). Classificação atual: INTERNAL_CONTROL + INTERPRETATION pendente de fonte primária.'),
  ('FAC-A03','11111111-0000-4000-8000-000000000003','Tema externo correlato: origem aceitável e limites de fatores (T10/T15). Nenhuma exigência normativa é afirmada aqui.'),
  ('FAC-A04','11111111-0000-4000-8000-000000000003','Tema externo correlato: independência amostral e semelhança (T07/T08). Controle interno até verificação primária.'),
  ('FAC-D03','11111111-0000-4000-8000-000000000003','Tema externo correlato: observações extremas/discrepantes e composição amostral (T22). Sem critério estatístico normativo registrado.'),
  ('FAC-I02','11111111-0000-4000-8000-000000000003','Tema externo correlato: valores unitários (T20). Semântica de área é decisão interna explícita.'),
  ('FAC-I03','11111111-0000-4000-8000-000000000003','Tema externo correlato: dados de oferta vs transação (T16/T17/T18).'),
  ('FAC-P01','11111111-0000-4000-8000-000000000003','Tema externo correlato: origem e derivação de fatores (T10/T11). Regra permanece controle interno de procedência.'),
  ('FAC-P02','11111111-0000-4000-8000-000000000003','Tema externo correlato: derivação de fatores (T11). Proibição é interna, não citação normativa.'),
  ('FAC-P03','11111111-0000-4000-8000-000000000003','Tema externo correlato: oferta vs transação (T18).'),
  ('FAC-P05','11111111-0000-4000-8000-000000000003','Tema externo correlato: homogeneização (T19). Nenhum cálculo existe.'),
  ('FAC-P07','11111111-0000-4000-8000-000000000003','Tema externo correlato: limites de aplicação (T15).'),
  ('FAC-R01','11111111-0000-4000-8000-000000000002','Tema externo correlato: documentação de fontes e requisitos de relatório (T29/T31).'),
  ('FAC-R02','11111111-0000-4000-8000-000000000002','Tema externo correlato: documentação de fontes dos dados (T29).'),
  ('FAC-R03','11111111-0000-4000-8000-000000000002','Tema externo correlato: exclusões e justificativa profissional (T23/T30).'),
  ('FAC-R04','11111111-0000-4000-8000-000000000002','Tema externo correlato: limitações conhecidas e apresentação (T32/T28).')
) as m(rule_code, source_id, note)
join public.methodology_rules r
  on r.method_specification_id = '33333333-0000-4000-8000-000000000001'
 and r.rule_code = m.rule_code
where not exists (
  select 1 from public.methodology_rule_sources x
   where x.rule_id = r.id and x.source_id = m.source_id::uuid and x.relationship_type = 'BACKGROUND'
);

-- 4) Seções: referências de fontes, limitações/questões abertas e riscos conhecidos.
update public.method_specification_sections
   set content = $sec$HIERARQUIA DE FONTES DESTA ESPECIFICAÇÃO (verificação declarada, nunca presumida)

1. PRIMARY NORMATIVE
   - ABNT NBR 14653-1 — METADATA_ONLY, metadados pendentes de revisão, conteúdo NÃO verificado, sem localizador verificado.
   - ABNT NBR 14653-2 — METADATA_ONLY, metadados pendentes de revisão, conteúdo NÃO verificado, sem localizador verificado.
   Consequência: nenhuma DIRECT_REQUIREMENT ou DIRECT_PROHIBITION pode ser derivada. Fatores, tabelas, mínimos amostrais, graus de fundamentação/precisão, campo de arbítrio e limites de extrapolação permanecem PENDING_PRIMARY_SOURCE_ACCESS.

2. PRIMARY REGULATORY
   - Resolução COFECI nº 1.066/2007 — METADATA_ONLY, conteúdo não incorporado.

3. PROFESSIONAL GUIDANCE
   - IVS (IVSC) — METADATA_ONLY.
   - RICS (uso responsável de IA) — METADATA_ONLY.
   - IBAPE (publicações e normas técnicas) — METADATA_ONLY. Recomendação profissional nunca é convertida automaticamente em MANDATORY.

4. TECHNICAL LITERATURE
   - DANTAS, Rubens Alves — METADATA_ONLY (obra protegida; apenas referência).
   - ABUNAHMAN, Sérgio Antônio — METADATA_ONLY (obra protegida; apenas referência).
   - FIKER, José — METADATA_ONLY (obra protegida; apenas referência).
   Literatura técnica pode sustentar TECHNICAL_SUPPORT após verificação humana; nunca é elevada a PRIMARY_NORMATIVE.

5. RESEARCH
   - COBREAP (trabalhos técnicos) — METADATA_ONLY, coletivo; cada trabalho exigirá entrada, artefato e verificação próprios.

6. INTERNAL
   - Fluxa Valuation — Especificação interna de controle metodológico: INTERNAL_AUTHORIZED_COPY, ACTIVE. Única fonte que sustenta INTERNAL_DESIGN. Nunca representa exigência de terceiros.

REGRA DE USO: fonte em METADATA_ONLY sustenta apenas relação BACKGROUND (identificação de tema). Conteúdo normativo exige artefato legítimo, CONTENT_VERIFIED e localizador verificado por revisor humano.$sec$
 where method_specification_id = '33333333-0000-4000-8000-000000000001'
   and section_key = 'SOURCE_REFERENCES';

update public.method_specification_sections
   set content = $sec$LIMITAÇÕES DECLARADAS E REGISTRO DE QUESTÕES ABERTAS (Fase 7B)

A. SOURCE_ACCESS_GAP
   - ABNT NBR 14653-1 e -2 permanecem METADATA_ONLY: definição do método, requisitos de dados e amostra, semelhança, origem/derivação/combinação de fatores, limites de aplicação, homogeneização, tratamento de observações discrepantes, grau de fundamentação, grau de precisão, campo de arbítrio, extrapolação e memória de cálculo permanecem sem base normativa verificada.
   - COFECI 1.066/2007, IVS, RICS, IBAPE e literatura técnica sem cópia legítima incorporada.

B. SOURCE_CONFLICT
   - Não avaliável nesta rodada: sem duas fontes com conteúdo verificado, divergência material não pode ser afirmada. Nenhum conflito foi registrado artificialmente em methodology_source_conflicts para derivação, aplicabilidade, combinação de fatores, tratamento de oferta, requisitos de amostra ou homogeneização.

C. PROFESSIONAL_DECISION_REQUIRED
   - Definir quais controles internos serão declarados como interpretação de exigência externa após acesso primário.
   - Decidir política de aceitação de fator publicado de terceiros (escopo, vigência, revisão).

D. TECHNICAL_RESEARCH_REQUIRED
   - Derivação empírica de fatores a partir do acervo próprio (sem cálculo nesta fase).
   - Critérios de semelhança e de observações extremas.

E. IMPLEMENTATION_DESIGN_LATER
   - Motor de cálculo, expressão de aplicação, combinação e homogeneização: fora de escopo até especificação aprovada.

NENHUM VALOR NUMÉRICO, FATOR, TABELA, CURVA, EXPOENTE, COEFICIENTE OU LIMIAR EXISTE NESTA VERSÃO.$sec$
 where method_specification_id = '33333333-0000-4000-8000-000000000001'
   and section_key = 'LIMITATIONS';

update public.method_specification_sections
   set content = $sec$RISCOS CONHECIDOS DE GOVERNANÇA

1. Uso de INTERNAL_DESIGN como atalho: risco de rotular exigência externa como controle interno para contornar verificação de fonte. Mitigação: vínculo BACKGROUND explícito ao tema externo, topic map T01..T32 e teste automatizado de má classificação.
2. Reconstrução indevida de norma a partir de material secundário (curso, slide, blog, laudo, planilha). Proibido: fonte secundária identifica tema, não substitui fonte primária.
3. Elevação indevida de literatura técnica ou orientação profissional a exigência obrigatória.
4. Introdução de fator, tabela ou expoente "de prática comum" sem procedência.
5. Confusão entre completude documental e confiabilidade metodológica.
6. Contaminação por conteúdo de fixture de pesquisa.
7. Aprovação prematura: a especificação permanece DRAFT e sem implementação registrada.$sec$
 where method_specification_id = '33333333-0000-4000-8000-000000000001'
   and section_key = 'KNOWN_RISKS';