-- FASE 7 — Tratamento por Fatores: preparação de especificação (sem motor).
-- Nenhuma constante valorativa, fator, tabela, pontuação ou fórmula é criada.

-- 1) Fonte interna de desenho/controle da plataforma.
insert into public.methodology_sources
  (id, organization_id, title, short_title, source_type, issuing_body, jurisdiction,
   access_status, authority_level, status, notes)
values
  ('11111111-0000-4000-8000-00000000000f', null,
   'Fluxa Valuation — Especificação interna de controle metodológico',
   'Controle interno Fluxa', 'INTERNAL_POLICY',
   'Fluxa Valuation (engenharia da plataforma)', 'ORGANIZATIONAL',
   'INTERNAL_AUTHORIZED_COPY', 'INTERNAL_SPECIFICATION', 'ACTIVE',
   'Fonte de procedência para regras INTERNAL_DESIGN / INTERNAL_CONTROL. Nunca representa exigência normativa de terceiros.')
on conflict (id) do nothing;

-- 2) Dicionário de dados metodológico (semântica exata, sem "AREA" genérica).
insert into public.methodology_data_dictionary
  (organization_id, concept_code, name, description, data_type, unit_code, semantic_notes)
values
  (null,'PROPERTY_TYPE','Tipologia do imóvel','Classe tipológica do avaliando/referência.','ENUM',null,'Vocabulário fechado em src/lib/domain/constants.ts. UNKNOWN nunca é convertido.'),
  (null,'PRIVATE_AREA','Área privativa','Área privativa em metros quadrados.','NUMBER','M2','Nunca substituível por BUILT_AREA.'),
  (null,'BUILT_AREA','Área construída','Área construída em metros quadrados.','NUMBER','M2','Conceito distinto de PRIVATE_AREA.'),
  (null,'LAND_AREA','Área de terreno','Área do lote em metros quadrados.','NUMBER','M2','Aplicável a terrenos e imóveis com terreno próprio.'),
  (null,'ASKING_PRICE','Preço pedido','Preço de oferta observado.','MONEY','BRL','Nunca tratado como preço transacionado.'),
  (null,'TRANSACTION_PRICE','Preço transacionado','Preço de transação com evidência própria.','MONEY','BRL','Exige observação CLOSED_SALE/CLOSED_RENT com fonte.'),
  (null,'OBSERVATION_DATE','Data da observação','Data da leitura registrada.','DATE','DATE','Base de contemporaneidade.'),
  (null,'PUBLICATION_DATE','Data de publicação','Data declarada de publicação do anúncio.','DATE','DATE','Distinta da data de observação.'),
  (null,'DISTANCE_TO_SUBJECT','Distância ao avaliando','Distância geodésica calculada.','NUMBER','KM','FEATURE FACTUAL. Não é fator de localização.'),
  (null,'DEVELOPMENT_ID','Empreendimento','Vínculo ao empreendimento/condomínio.','TEXT',null,'Usado em análise de independência amostral.'),
  (null,'DISTRICT','Bairro/distrito','Unidade territorial declarada.','TEXT',null,'Estado de conhecimento explícito quando ausente.'),
  (null,'CONSTRUCTION_YEAR','Ano de construção','Ano de construção declarado ou verificado.','INTEGER','YEAR','Idade cronológica derivada exige data de referência explícita.'),
  (null,'PARKING_SPACES','Vagas de garagem','Quantidade de vagas.','COUNT','COUNT','UNKNOWN nunca vira zero.'),
  (null,'FLOOR_LEVEL','Andar','Pavimento da unidade.','INTEGER','COUNT','UNKNOWN nunca vira zero.'),
  (null,'CONDITION','Estado de conservação','Estado de conservação observado.','ENUM',null,'Vocabulário condition_status; UNKNOWN preservado.'),
  (null,'UNIT_VALUE','Valor unitário','Valor por unidade de área.','MONEY','BRL','Semântica de área do denominador deve ser declarada explicitamente.'),
  (null,'OBSERVED_ASKING_TO_TRANSACTION_DELTA','Delta observado oferta→transação','Diferença factual observada entre preço pedido e transacionado.','RATIO','RATIO','Evidência factual. Não é fator de oferta.')
on conflict do nothing;

-- 3) Seções do rascunho (conteúdo rastreável; lacunas declaradas).
insert into public.method_specification_sections
  (organization_id, method_specification_id, section_key, ordinal, content)
values
(null,'33333333-0000-4000-8000-000000000001','PURPOSE',1,
'ESTADO: PREPARAÇÃO (DRAFT).
Objetivo declarado desta especificação: descrever, de forma rastreável e revisável, o Tratamento por Fatores dentro do Método Comparativo Direto de Dados de Mercado (MCDDM), para futura implementação sob aprovação profissional.
PENDING_PRIMARY_SOURCE: a definição normativa do MCDDM e a posição do tratamento por fatores dependem de ABNT NBR 14653-1 e 14653-2, hoje registradas como METADATA_ONLY. Nenhuma finalidade normativa é afirmada aqui.
Classificação do conteúdo desta seção: INTERNAL_DESIGN.'),
(null,'33333333-0000-4000-8000-000000000001','INTENDED_USE',2,
'INTERNAL_DESIGN: uso pretendido futuro — apoio a laudo técnico de avaliação de imóveis urbanos elaborado por profissional habilitado, com dataset congelado e evidência verificada.
PENDING_PRIMARY_SOURCE: enquadramento de finalidade (PTAM, laudo técnico, laudo pericial judicial) e suas exigências distintas dependem de fonte normativa/regulatória verificada (ABNT, COFECI 1.066/2007, IBAPE). Não se presume equivalência entre esses documentos.'),
(null,'33333333-0000-4000-8000-000000000001','APPLICABILITY',3,
'CANDIDATO (INTERNAL_DESIGN, sujeito a substituição por regra normativa verificada):
- exige amostra de referências de mercado com evidência verificada e linhagem íntegra;
- exige semântica de área declarada e compatível entre avaliando e referências;
- exige fatores com procedência, escopo territorial e vigência declarados.
PENDING_PRIMARY_SOURCE: condições normativas de aplicabilidade do tratamento por fatores (inclusive qualquer condição amostral quantitativa) não são afirmadas sem acesso legítimo ao texto primário.'),
(null,'33333333-0000-4000-8000-000000000001','NON_APPLICABILITY',4,
'CANDIDATO (INTERNAL_DESIGN):
- ausência de fator com procedência para uma diferença material observada;
- fator disponível apenas para escopo territorial/tipológico distinto do caso;
- amostra sem qualquer observação com evidência de preço verificada.
PENDING_PRIMARY_SOURCE: contraindicações normativas explícitas. Nenhuma contraindicação foi criada por opinião do modelo.'),
(null,'33333333-0000-4000-8000-000000000001','REQUIRED_INPUTS',5,
'Semântica exata exigida (nunca "AREA" genérica): PROPERTY_TYPE; PRIVATE_AREA ou BUILT_AREA ou LAND_AREA conforme tipologia declarada; ASKING_PRICE e/ou TRANSACTION_PRICE com natureza explícita; OBSERVATION_DATE; identificação territorial; identificação de empreendimento quando existente.
Comportamento com ausência: MISSING_REQUIRED_INPUT. Nunca zero, nunca estimativa por IA, nunca substituição por outro conceito de área.'),
(null,'33333333-0000-4000-8000-000000000001','OPTIONAL_INPUTS',6,
'CONSTRUCTION_YEAR; CONDITION; PARKING_SPACES; FLOOR_LEVEL; DISTANCE_TO_SUBJECT (feature factual); DEVELOPMENT_ID; PUBLICATION_DATE.
Input opcional ausente permanece UNKNOWN e não habilita fator algum.'),
(null,'33333333-0000-4000-8000-000000000001','DATA_REQUIREMENTS',7,
'INTERNAL_DESIGN: cada observação usada precisa de fonte identificada, verificação humana registrada e linhagem íntegra; preço pedido e preço transacionado permanecem colunas e evidências distintas; duplicidade entre anúncios do mesmo imóvel exige resolução humana antes do uso como referências independentes.
PENDING_PRIMARY_SOURCE: requisitos normativos de amostra — quantidade mínima, contemporaneidade admissível, dispersão, semelhança — não são declarados sem texto primário verificado. Nenhum limiar numérico foi inventado.'),
(null,'33333333-0000-4000-8000-000000000001','RULES',8,
'26 regras candidatas registradas em methodology_rules, todas com normative_strength = INTERNAL_CONTROL e procedência INTERNAL_DESIGN vinculada à fonte interna da plataforma.
Nenhuma regra está classificada como DIRECT_REQUIREMENT ou DIRECT_PROHIBITION: isso exigiria fonte com CONTENT_VERIFIED e localizador verificado, inexistente hoje.'),
(null,'33333333-0000-4000-8000-000000000001','FORMULAS',9,
'PENDING_PRIMARY_SOURCE. Nenhuma fórmula candidata foi registrada.
Motivo declarado: a forma matemática de aplicação dos fatores e a forma de combinação entre fatores (produto, soma, sequência ou outra) não podem ser afirmadas por memória de modelo, snippet, curso ou resumo de terceiro. Enquanto o texto primário não estiver legitimamente acessível, o estado é FORMULA_INTERPRETATION_PENDING para todos os tópicos T13 e T14.'),
(null,'33333333-0000-4000-8000-000000000001','ASSUMPTIONS',10,
'INTERNAL_DESIGN: (a) toda referência de mercado é evidência datada, não fato permanente; (b) diferença factual observada (feature) não implica ajuste de valor; (c) delta observado oferta→transação é evidência empírica e não fator de oferta; (d) desconhecimento é estado explícito, nunca valor neutro.'),
(null,'33333333-0000-4000-8000-000000000001','DIAGNOSTICS',11,
'CANDIDATO (INTERNAL_DESIGN): fator sem procedência; fator fora de escopo territorial/tipológico; parâmetro fora do período de vigência; input requerido ausente; semântica de área incompatível; preço pedido usado onde a regra exige transação; concentração de fonte/tempo/espaço na amostra; duplicidade não resolvida.
PENDING_PRIMARY_SOURCE: qualquer diagnóstico normativo com limiar numérico.'),
(null,'33333333-0000-4000-8000-000000000001','LIMITATIONS',12,
'Declaração honesta do estado atual: esta especificação não define fatores operacionais, valores, tabelas, pontuações, limites nem fórmulas. Nenhum valor imobiliário é calculado por nenhuma parte da plataforma.
Limitação de fonte: as normas primárias brasileiras aplicáveis constam apenas como METADATA_ONLY; portanto o conteúdo normativo do método permanece não verificado nesta plataforma.'),
(null,'33333333-0000-4000-8000-000000000001','OUTPUTS',13,
'Contrato de saída declarado (declarativo, não implementado): valor estimado, intervalo, valor unitário, diagnósticos, avisos, premissas, evidências usadas, evidências excluídas, incerteza e enquadramento de conformidade — cada um acompanhado da procedência de todo fator e parâmetro empregado.
Nenhum componente de produção calcula qualquer desses itens hoje.'),
(null,'33333333-0000-4000-8000-000000000001','UNCERTAINTY',14,
'PENDING_PRIMARY_SOURCE_VERIFICATION. Fundamentação, precisão e campo de arbítrio são temas de alta criticidade normativa: nenhuma pontuação, grau, tabela, limite ou threshold foi registrado, por ausência de acesso legítimo ao texto primário.'),
(null,'33333333-0000-4000-8000-000000000001','REPORTING_REQUIREMENTS',15,
'CANDIDATO (INTERNAL_DESIGN): o relatório futuro deve conter descrição da metodologia aplicada e sua versão selada; identificação de cada fonte metodológica e localizador; dados utilizados com evidência e data; justificativa da amostra; cada fator empregado com procedência, escopo e vigência; memória de cálculo reproduzível; limitações declaradas; resultado; e enquadramento normativo aplicável quando verificável.
PENDING_PRIMARY_SOURCE: exigências formais de relatório previstas em norma/regulação, e as diferenças entre PTAM, laudo técnico e laudo pericial judicial.'),
(null,'33333333-0000-4000-8000-000000000001','SOURCE_REFERENCES',16,
'Disponível e usada: fonte interna de controle da plataforma (INTERNAL_SPECIFICATION) — sustenta apenas regras INTERNAL_CONTROL.
Registradas mas METADATA_ONLY (não sustentam claim normativa): ABNT NBR 14653 (família), ABNT NBR 14653-1, ABNT NBR 14653-2, COFECI 1.066/2007, IVS, RICS.
Ausentes do registro: IBAPE Nacional e estaduais, literatura técnica (p. ex. Dantas, Abunahman, Fiker) e pesquisa aplicada (COBREAP, estudos empíricos regionais). Nenhuma delas foi citada como suporte de regra.
Provedor de pesquisa externa real não configurado (modo FIXTURE só de teste): nenhuma pesquisa externa foi simulada.'),
(null,'33333333-0000-4000-8000-000000000001','TEST_REQUIREMENTS',17,
'14 requisitos de teste registrados em method_test_cases para o futuro motor, cobrindo UNIT, NUMERIC, BOUNDARY, NEGATIVE, COMPLIANCE, REPRODUCIBILITY e AUDITABILITY — incluindo falha obrigatória para fator sem procedência, escopo incorreto, parâmetro expirado, input ausente, semântica de área trocada, oferta tratada como transação e constante valorativa não registrada.
Nenhuma matemática de avaliação é implementada.'),
(null,'33333333-0000-4000-8000-000000000001','KNOWN_RISKS',18,
'Risco 1: operacionalizar fator por prática comum, sem procedência. Mitigação: proibição de valor sem fonte, escopo e vigência.
Risco 2: confundir feature factual com ajuste de valor. Mitigação: separação permanente FEATURE ≠ FACTOR.
Risco 3: reconstruir norma por memória de modelo ou snippet. Mitigação: METADATA_ONLY nunca sustenta claim normativa.
Risco 4: escopo regional tratado como nacional. Mitigação: escopo e jurisdição obrigatórios por fator.
Risco 5: contaminação por conteúdo de teste (fixture). Mitigação: suíte que prova ausência de TEST_ONLY no shell real.')
on conflict do nothing;

-- 4) Regras candidatas (todas INTERNAL_CONTROL / DRAFT).
with r as (
  insert into public.methodology_rules
    (organization_id, method_specification_id, rule_code, title, rule_type, description,
     normative_strength, status, priority)
  values
  (null,'33333333-0000-4000-8000-000000000001','FAC-A01','Amostra exige evidência verificada','APPLICABILITY','Cada referência usada precisa de fonte identificada e verificação humana registrada.','INTERNAL_CONTROL','DRAFT',10),
  (null,'33333333-0000-4000-8000-000000000001','FAC-A02','Semântica de área declarada','APPLICABILITY','Avaliando e referências devem usar o mesmo conceito de área, declarado explicitamente.','INTERNAL_CONTROL','DRAFT',20),
  (null,'33333333-0000-4000-8000-000000000001','FAC-A03','Fator exige escopo e vigência','APPLICABILITY','Fator só é elegível se declarar escopo territorial, tipológico e período de vigência.','INTERNAL_CONTROL','DRAFT',30),
  (null,'33333333-0000-4000-8000-000000000001','FAC-A04','Duplicidade resolvida antes do uso','APPLICABILITY','Anúncios do mesmo imóvel não contam como referências independentes sem resolução humana.','INTERNAL_CONTROL','DRAFT',40),
  (null,'33333333-0000-4000-8000-000000000001','FAC-I01','Tipologia obrigatória','INPUT_REQUIREMENT','PROPERTY_TYPE é input obrigatório e não admite inferência automática.','INTERNAL_CONTROL','DRAFT',50),
  (null,'33333333-0000-4000-8000-000000000001','FAC-I02','Área exigida por semântica exata','INPUT_REQUIREMENT','Exigir PRIVATE_AREA, BUILT_AREA ou LAND_AREA conforme tipologia; nunca "área" genérica.','INTERNAL_CONTROL','DRAFT',60),
  (null,'33333333-0000-4000-8000-000000000001','FAC-I03','Natureza do preço explícita','INPUT_REQUIREMENT','Todo preço entra identificado como pedido ou transacionado.','INTERNAL_CONTROL','DRAFT',70),
  (null,'33333333-0000-4000-8000-000000000001','FAC-I04','Data de observação obrigatória','INPUT_REQUIREMENT','Sem data de observação a referência não é utilizável.','INTERNAL_CONTROL','DRAFT',80),
  (null,'33333333-0000-4000-8000-000000000001','FAC-I05','Input ausente é estado, não zero','INPUT_REQUIREMENT','Input requerido nulo produz MISSING_REQUIRED_INPUT.','INTERNAL_CONTROL','DRAFT',90),
  (null,'33333333-0000-4000-8000-000000000001','FAC-P01','Proibido fator sem procedência','PROHIBITION','Nenhum fator pode ser aplicado sem fonte, derivação e revisão registradas.','INTERNAL_CONTROL','DRAFT',100),
  (null,'33333333-0000-4000-8000-000000000001','FAC-P02','Proibido valor default de fator','PROHIBITION','Nenhum valor numérico de fator entra por prática comum ou memória.','INTERNAL_CONTROL','DRAFT',110),
  (null,'33333333-0000-4000-8000-000000000001','FAC-P03','Proibido converter pedido em transação','PROHIBITION','Preço pedido nunca é tratado como preço transacionado.','INTERNAL_CONTROL','DRAFT',120),
  (null,'33333333-0000-4000-8000-000000000001','FAC-P04','Proibido substituir semântica de área','PROHIBITION','Área construída não substitui área privativa nem vice-versa.','INTERNAL_CONTROL','DRAFT',130),
  (null,'33333333-0000-4000-8000-000000000001','FAC-P05','Proibido converter feature em ajuste','PROHIBITION','Diferença factual observada não gera ajuste de valor por si.','INTERNAL_CONTROL','DRAFT',140),
  (null,'33333333-0000-4000-8000-000000000001','FAC-P06','Proibida constante valorativa oculta','PROHIBITION','Constante que afete valor precisa existir como parâmetro declarado.','INTERNAL_CONTROL','DRAFT',150),
  (null,'33333333-0000-4000-8000-000000000001','FAC-P07','Proibido escopo estendido','PROHIBITION','Fator de escopo regional não se aplica fora do escopo declarado.','INTERNAL_CONTROL','DRAFT',160),
  (null,'33333333-0000-4000-8000-000000000001','FAC-P08','Proibida claim normativa sem verificação','PROHIBITION','Fonte METADATA_ONLY não sustenta exigência nem proibição normativa.','INTERNAL_CONTROL','DRAFT',170),
  (null,'33333333-0000-4000-8000-000000000001','FAC-P09','Proibida metodologia por fixture','PROHIBITION','Conteúdo de pesquisa em modo fixture nunca popula metodologia real.','INTERNAL_CONTROL','DRAFT',180),
  (null,'33333333-0000-4000-8000-000000000001','FAC-D01','Diagnóstico de fator sem procedência','DIAGNOSTIC','Sinalizar fator elegível sem fonte/derivação registrada.','INTERNAL_CONTROL','DRAFT',190),
  (null,'33333333-0000-4000-8000-000000000001','FAC-D02','Diagnóstico de parâmetro expirado','DIAGNOSTIC','Sinalizar parâmetro fora do período de vigência.','INTERNAL_CONTROL','DRAFT',200),
  (null,'33333333-0000-4000-8000-000000000001','FAC-D03','Diagnóstico de concentração amostral','DIAGNOSTIC','Sinalizar concentração de fonte, tempo ou espaço na amostra.','INTERNAL_CONTROL','DRAFT',210),
  (null,'33333333-0000-4000-8000-000000000001','FAC-D04','Diagnóstico de divergência de atributo','DIAGNOSTIC','Sinalizar atributo divergente entre observações sem adoção humana.','INTERNAL_CONTROL','DRAFT',220),
  (null,'33333333-0000-4000-8000-000000000001','FAC-R01','Relatar procedência de cada fator','REPORTING','O relatório deve listar fonte, escopo e vigência de cada fator empregado.','INTERNAL_CONTROL','DRAFT',230),
  (null,'33333333-0000-4000-8000-000000000001','FAC-R02','Relatar dados e evidências usadas','REPORTING','O relatório deve identificar cada dado usado e sua evidência.','INTERNAL_CONTROL','DRAFT',240),
  (null,'33333333-0000-4000-8000-000000000001','FAC-R03','Relatar exclusões e motivos','REPORTING','Elemento excluído permanece no acervo com motivo declarado.','INTERNAL_CONTROL','DRAFT',250),
  (null,'33333333-0000-4000-8000-000000000001','FAC-R04','Relatar limitações e lacunas','REPORTING','Limitações e lacunas de fonte devem constar explicitamente.','INTERNAL_CONTROL','DRAFT',260)
  returning id
)
insert into public.methodology_rule_sources
  (organization_id, rule_id, source_id, relationship_type, interpretation_notes)
select null, r.id, '11111111-0000-4000-8000-00000000000f', 'INTERNAL_DESIGN',
       'Controle interno de engenharia da plataforma. Não é exigência de norma de terceiro.'
from r;

-- 5) Aplicabilidade candidata.
insert into public.method_applicability_rules
  (organization_id, method_specification_id, criterion_code, criterion_description, expected_result, notes)
values
  (null,'33333333-0000-4000-8000-000000000001','APP-TYPE','Tipologia do avaliando compatível com os fatores disponíveis e seu escopo declarado.','METHOD_REQUIRES_PROFESSIONAL_REVIEW','Sem fonte normativa verificada; decisão profissional obrigatória.'),
  (null,'33333333-0000-4000-8000-000000000001','APP-TERRITORY','Escopo territorial dos fatores cobre o mercado do avaliando.','METHOD_REQUIRES_PROFESSIONAL_REVIEW','PENDING_PRIMARY_SOURCE para qualquer regra normativa de escopo.'),
  (null,'33333333-0000-4000-8000-000000000001','APP-EVIDENCE','Amostra possui evidência verificada e linhagem íntegra.','METHOD_REQUIRES_PROFESSIONAL_REVIEW','Controle interno da plataforma.'),
  (null,'33333333-0000-4000-8000-000000000001','APP-SAMPLE','Características amostrais (contemporaneidade, similaridade, dispersão) adequadas ao caso.','METHOD_REQUIRES_PROFESSIONAL_REVIEW','Nenhum limiar numérico declarado: PENDING_PRIMARY_SOURCE.'),
  (null,'33333333-0000-4000-8000-000000000001','APP-FACTORS','Existe fator com procedência para cada diferença material relevante.','METHOD_REQUIRES_PROFESSIONAL_REVIEW','Sem fator com procedência, o método não é aplicável.')
on conflict do nothing;

-- 6) Requisitos de teste do futuro motor.
insert into public.method_test_cases
  (organization_id, method_specification_id, test_code, title, test_type, expected_status, source_reference)
values
  (null,'33333333-0000-4000-8000-000000000001','T-UNSOURCED-FACTOR','Fator sem procedência deve falhar validação','NEGATIVE','MUST_FAIL','FAC-P01'),
  (null,'33333333-0000-4000-8000-000000000001','T-WRONG-SCOPE','Fator fora do escopo declarado deve bloquear ou exigir revisão','NEGATIVE','MUST_FAIL_OR_REVIEW','FAC-P07'),
  (null,'33333333-0000-4000-8000-000000000001','T-EXPIRED-PARAM','Parâmetro fora da vigência não pode ser usado silenciosamente','NEGATIVE','MUST_FAIL','FAC-D02'),
  (null,'33333333-0000-4000-8000-000000000001','T-MISSING-INPUT','Input requerido nulo não vira zero','NEGATIVE','MUST_FAIL','FAC-I05'),
  (null,'33333333-0000-4000-8000-000000000001','T-AREA-SEMANTIC','Área construída não substitui área privativa','NEGATIVE','MUST_FAIL','FAC-P04'),
  (null,'33333333-0000-4000-8000-000000000001','T-OFFER-TRANSACTION','Preço pedido nunca é tratado como transação','NEGATIVE','MUST_FAIL','FAC-P03'),
  (null,'33333333-0000-4000-8000-000000000001','T-UNSOURCED-CONSTANT','Constante valorativa não registrada falha validação','COMPLIANCE','MUST_FAIL','FAC-P06'),
  (null,'33333333-0000-4000-8000-000000000001','T-FEATURE-NOT-FACTOR','Feature factual não gera ajuste de valor','NEGATIVE','MUST_FAIL','FAC-P05'),
  (null,'33333333-0000-4000-8000-000000000001','T-SPEC-BINDING','Execução exige especificação aprovada e selada','COMPLIANCE','MUST_FAIL_IF_UNAPPROVED','METHODOLOGY_GOVERNANCE'),
  (null,'33333333-0000-4000-8000-000000000001','T-REPRODUCIBLE-RUN','Mesma entrada e mesma versão produzem mesmo resultado','REPRODUCIBILITY','MUST_MATCH','FAC-R02'),
  (null,'33333333-0000-4000-8000-000000000001','T-RUN-MANIFEST','Toda execução gera manifesto auditável com procedência','AUDITABILITY','MUST_EXIST','FAC-R01'),
  (null,'33333333-0000-4000-8000-000000000001','T-BOUNDARY-INPUTS','Valores de fronteira de input são tratados explicitamente','BOUNDARY','PENDING_SPECIFICATION','PENDING_PRIMARY_SOURCE'),
  (null,'33333333-0000-4000-8000-000000000001','T-NUMERIC-FIXTURE','Caso numérico de referência com fonte declarada','NUMERIC','PENDING_PRIMARY_SOURCE','PENDING_PRIMARY_SOURCE'),
  (null,'33333333-0000-4000-8000-000000000001','T-UNIT-COMBINATION','Combinação de fatores conforme fórmula aprovada','UNIT','PENDING_SPECIFICATION','T14 PENDING_PRIMARY_SOURCE')
on conflict do nothing;

-- 7) Contrato de saída declarado (sem implementação).
insert into public.method_output_contracts
  (organization_id, method_specification_id, output_type, description, unit_code, required)
values
  (null,'33333333-0000-4000-8000-000000000001','ESTIMATED_VALUE','Valor estimado do avaliando (não implementado).','BRL',true),
  (null,'33333333-0000-4000-8000-000000000001','VALUE_INTERVAL','Intervalo de valor conforme especificação futura.','BRL',false),
  (null,'33333333-0000-4000-8000-000000000001','UNIT_VALUE','Valor unitário com semântica de área declarada.','BRL',false),
  (null,'33333333-0000-4000-8000-000000000001','DIAGNOSTICS','Diagnósticos determinísticos da execução.',null,true),
  (null,'33333333-0000-4000-8000-000000000001','WARNINGS','Avisos não bloqueantes.',null,true),
  (null,'33333333-0000-4000-8000-000000000001','ASSUMPTIONS','Premissas declaradas.',null,true),
  (null,'33333333-0000-4000-8000-000000000001','USED_EVIDENCE','Evidências usadas com linhagem.',null,true),
  (null,'33333333-0000-4000-8000-000000000001','EXCLUDED_EVIDENCE','Evidências excluídas com motivo.',null,true),
  (null,'33333333-0000-4000-8000-000000000001','UNCERTAINTY','Incerteza declarada (PENDING_PRIMARY_SOURCE).',null,false),
  (null,'33333333-0000-4000-8000-000000000001','COMPLIANCE','Enquadramento de conformidade verificável.',null,true)
on conflict do nothing;