# Evidence Vault

Quero iniciar a construção de uma plataforma profissional de Inteligência Pericial e Avaliação Imobiliária Multimetodológica.

IMPORTANTE: execute este trabalho. Não quero apenas sugestões de arquitetura.

Antes de modificar qualquer coisa, inspecione o estado atual do projeto e preserve corretamente tudo o que já existir e for compatível com estas instruções.

1. VISÃO DO PRODUTO

Esta plataforma NÃO é uma calculadora simples de preço de imóveis.

Ela será um sistema profissional destinado a organizar evidências imobiliárias, construir datasets tecnicamente auditáveis, executar diferentes metodologias de avaliação de maneira independente e futuramente realizar convergência entre:

Método Comparativo Direto com tratamento por fatores;

Método Comparativo Direto com inferência estatística;

modelos AVM de Machine Learning;

métodos complementares aplicáveis, como renda, evolutivo, involutivo e custo.

A primeira fase NÃO deve implementar ainda os modelos de avaliação.

Nesta fase, construa a FUNDAÇÃO DA PLATAFORMA e o EVIDENCE INTELLIGENCE ENGINE.

O princípio central do sistema é:

IA não é fonte de evidência.

IA pode descobrir, ler, extrair, classificar e sugerir informações, mas uma informação produzida pela IA nunca pode se transformar silenciosamente em dado factual utilizado numa avaliação.

Todo dado utilizado futuramente por um modelo precisa possuir proveniência, evidência original, histórico, validação e rastreabilidade.

2. REGRA FUNDAMENTAL CONTRA ALUCINAÇÃO

Implemente a arquitetura obedecendo a esta cadeia:

RAW SOURCE
→ CAPTURED EVIDENCE
→ EXTRACTED CANDIDATE
→ VALIDATION
→ VERIFIED EVIDENCE
→ VALUATION DATASET

Nunca permita:

AI OUTPUT
→ VALUATION DATASET

diretamente.

A IA futuramente poderá escrever somente em estruturas de "candidate extraction" ou equivalentes.

A IA NÃO poderá:

alterar evidência original;

marcar informação como verificada;

inserir diretamente dados em dataset congelado;

inventar fonte;

inventar URL;

preencher informação ausente por plausibilidade;

transformar inferência em fato;

substituir dado documental por conhecimento do modelo;

modificar silenciosamente números;

eliminar evidências utilizadas ou descartadas.

Quando um dado não puder ser comprovado, o sistema deverá trabalhar com estados como:

"não encontrado"
"não informado"
"não verificável"
"divergente"
"pendente de validação"

e nunca completar o dado por suposição.

3. BACKEND

Utilize Supabase/PostgreSQL como backend principal.

Se ainda NÃO existir Supabase conectado ao projeto:

NÃO simule banco de dados.
NÃO crie persistência falsa em localStorage.
NÃO crie dados mockados fingindo que são persistentes.

Nesse caso, pare somente a parte que depende de backend e me informe claramente que preciso conectar um projeto Supabase antes de prosseguir.

Se Supabase estiver conectado, implemente a estrutura abaixo.

Toda lógica crítica deve estar no backend.

Frontend nunca deve ser considerado fronteira de segurança.

Utilize:

Supabase Auth;

PostgreSQL;

Row Level Security;

Supabase Storage;

Edge Functions quando houver lógica sensível;

migrations versionadas;

timestamps em UTC;

UUIDs para entidades principais.

Nunca exponha secrets, API keys ou service role keys no frontend.

4. ARQUITETURA MULTI-TENANT

A plataforma deve nascer preparada para múltiplas organizações/escritórios.

Crie conceito de:

organizations
profiles
organization_members

Roles iniciais:

OWNER
ADMIN
VALUER
REVIEWER
VIEWER

Não confie na role existente no frontend.

Autorização deve ser validada server-side e protegida também por RLS.

Um usuário de uma organização não pode visualizar, alterar, descobrir ou inferir dados pertencentes a outra organização.

5. ENTIDADE CENTRAL: CASO DE AVALIAÇÃO

Crie uma entidade principal chamada valuation_case.

Um valuation_case representa uma avaliação/perícia específica.

Campos mínimos:

id
organization_id
case_code
title
purpose
valuation_date
status
created_by
created_at
updated_at

Status iniciais:

DRAFT
EVIDENCE_COLLECTION
DATA_REVIEW
DATASET_FROZEN
VALUATION
REVIEW
COMPLETED
ARCHIVED

Não permita transições críticas apenas por manipulação de frontend.

Prepare a arquitetura para regras de transição server-side.

6. IMÓVEL AVALIANDO

Crie entidade property vinculada ao valuation_case.

Estruture pelo menos:

id
valuation_case_id
property_type
address_line
address_number
complement
district
city
state
postal_code
country
latitude
longitude
private_area
built_area
land_area
bedrooms
bathrooms
parking_spaces
construction_year
floor_number
description
created_at
updated_at

Não use float para valores monetários.

Para áreas e grandezas que necessitem precisão decimal, utilize tipos apropriados.

Prepare o modelo para futura utilização de PostGIS, sem comprometer a implementação atual caso a extensão ainda não esteja habilitada.

7. EVIDENCE ENGINE

Crie um núcleo de evidências independente do imóvel.

Precisamos distinguir:

FONTE
ARTEFATO ORIGINAL
EXTRAÇÃO
AFIRMAÇÃO/DADO EXTRAÍDO
VALIDAÇÃO
DECISÃO DE USO

Projete entidades equivalentes a:

evidence_sources
evidence_artifacts
evidence_extractions
evidence_fields
evidence_reviews

Você pode melhorar os nomes caso exista uma estrutura mais consistente, mas mantenha a separação conceitual.

evidence_source

Representa a origem.

Campos relevantes:

id
organization_id
valuation_case_id
source_type
source_name
source_url
publisher_or_owner
accessed_at
publication_date
notes
created_by
created_at

Tipos de fonte iniciais:

OFFICIAL_PUBLIC_SOURCE
PUBLIC_REGISTRY
PRIVATE_DOCUMENT
TRANSACTION_EVIDENCE
REAL_ESTATE_LISTING
BROKER_INFORMATION
USER_PROVIDED
FIELD_INSPECTION
OTHER

Não transforme esta classificação em hierarquia normativa.

É apenas uma taxonomia interna da plataforma.

evidence_artifact

É a prova capturada.

Pode representar:

PDF
imagem
screenshot
HTML capturado
planilha
documento
foto
arquivo enviado pelo usuário
resposta estruturada de uma API

Armazene o arquivo original em bucket PRIVADO.

Não torne evidências publicamente acessíveis.

Campos mínimos:

id
evidence_source_id
storage_path
mime_type
file_name
file_size
sha256_hash
captured_at
created_by
created_at

O hash deve ser calculado server-side quando tecnicamente possível.

Não considere um hash calculado apenas pelo navegador como mecanismo de integridade confiável.

evidence_extraction

Representa uma tentativa de extração de informações de um artefato.

Inclua:

id
artifact_id
extraction_type
processor_type
processor_name
processor_version
prompt_version
status
raw_output
created_at

processor_type poderá futuramente ser:

MANUAL
DETERMINISTIC_PARSER
OCR
LLM
COMPUTER_VISION
EXTERNAL_API

Status:

PENDING
PROCESSING
COMPLETED
FAILED
REVIEW_REQUIRED

Importante:

raw_output deve preservar o resultado original da extração para fins de auditoria.

8. DADO EXTRAÍDO COM PROVENIÊNCIA

Crie evidence_fields ou estrutura equivalente para armazenar cada informação candidata individualmente.

Exemplos:

preço
área
endereço
número de vagas
andar
data
condomínio
IPTU
tipologia
estado de conservação

Cada campo extraído precisa possuir pelo menos:

id
extraction_id
field_name
raw_value
normalized_value
unit
source_excerpt
source_locator
validation_status
created_at

source_excerpt deve guardar, quando aplicável, o trecho exato que sustenta o dado.

source_locator deve permitir apontar onde a informação estava:

página;

seção;

seletor;

posição;

referência de API;

ou outra localização apropriada.

Se não houver evidência que sustente aquele valor, o campo NÃO poderá virar VERIFIED.

9. NÃO USAR "CONFIANÇA DA IA" COMO VERDADE

Não crie agora um número arbitrário como:

"IA tem 97% de confiança".

Não quero porcentagens inventadas pelo LLM.

Futuramente criaremos um Evidence Confidence Score próprio baseado em critérios mensuráveis.

Por enquanto, prepare a arquitetura para avaliações distintas de:

qualidade da fonte;

completude;

atualidade;

relevância espacial;

relevância temporal;

consistência interna;

confirmação cruzada;

qualidade da extração;

validação humana.

Não calcule ainda uma nota final sem termos definido formalmente pesos, regras e calibração.

10. PROCESSO DE VALIDAÇÃO

Implemente workflow explícito:

CAPTURED
EXTRACTED
PENDING_REVIEW
VERIFIED
REJECTED

Um campo VERIFIED precisa registrar:

verified_by
verified_at
verification_notes

Um campo REJECTED precisa registrar:

rejected_by
rejected_at
rejection_reason

Uma eventual correção não deve apagar o valor original.

Preserve histórico.

11. IMUTABILIDADE

Evidência bruta não deve ser silenciosamente editada.

Após captura:

fonte original deve permanecer preservada;

artifact original deve permanecer preservado;

hash deve permanecer registrado;

extrações devem ser versionadas;

correções devem gerar nova versão ou registro;

histórico não deve ser sobrescrito.

Evite DELETE físico de registros de auditoria, evidências congeladas e datasets usados em avaliação.

Use arquivamento ou status apropriado quando necessário.

12. DATASET DE AVALIAÇÃO

Crie desde já a arquitetura de datasets, mesmo sem implementar os modelos.

Entidades:

dataset_versions
dataset_items

Um dataset_version pertence a um valuation_case.

Campos desejados:

id
valuation_case_id
version_number
name
description
purpose
created_by
created_at
frozen_at
frozen_by
dataset_hash
known_limitations

dataset_items deve apontar para os dados/evidências efetivamente incluídos naquela versão.

Antes do congelamento:

dataset pode ser alterado.

Depois de frozen_at:

não deve ser editável.

Qualquer alteração posterior deve produzir uma NOVA VERSÃO.

O dataset utilizado numa avaliação precisa ser reproduzível futuramente.

13. DATASHEET DO DATASET

Prepare uma visualização denominada:

"Ficha do Dataset"

Ela deverá futuramente documentar:

finalidade;

período temporal;

região geográfica;

quantidade de elementos;

tipos de fonte;

critérios de inclusão;

critérios de exclusão;

limitações conhecidas;

campos ausentes;

evidências rejeitadas;

responsável pela revisão;

data do congelamento;

hash da versão.

Nesta fase, implemente a estrutura necessária e uma interface inicial funcional.

14. REGISTRO DE IA

Mesmo que ainda não adicionemos IA real, crie a arquitetura para ai_runs.

Cada execução futura de IA precisa permitir registrar:

id
organization_id
valuation_case_id
purpose
provider
model
model_version
system_prompt_version
task_prompt_version
input_evidence_ids
output_raw
status
started_at
completed_at
created_by

Nunca permitir que output_raw seja considerado evidência verificada automaticamente.

Essa estrutura servirá para reconstruir posteriormente:

qual modelo foi usado;
qual prompt;
quais fontes foram apresentadas;
e qual resposta foi gerada.

15. AUDIT LOG

Implemente audit_log append-only.

Registre eventos relevantes como:

CASE_CREATED
CASE_STATUS_CHANGED
PROPERTY_CREATED
PROPERTY_UPDATED
EVIDENCE_SOURCE_CREATED
ARTIFACT_CAPTURED
EXTRACTION_CREATED
FIELD_VERIFIED
FIELD_REJECTED
DATASET_CREATED
DATASET_ITEM_ADDED
DATASET_ITEM_REMOVED
DATASET_FROZEN
USER_ROLE_CHANGED

Campos:

id
organization_id
valuation_case_id
actor_user_id
event_type
entity_type
entity_id
before_data
after_data
metadata
created_at

Usuários comuns não podem alterar ou excluir audit logs.

16. STORAGE

Crie buckets privados adequados.

Sugestão:

evidence-originals
property-media
generated-reports

Não use URLs públicas permanentes para evidências privadas.

Utilize acesso autenticado e signed URLs quando necessário.

Configure políticas de Storage coerentes com organization_id/case ownership.

17. INTERFACE PRINCIPAL

A interface deve ser profissional, séria, limpa e adequada a um produto técnico/jurídico.

Não quero aparência de "template genérico de startup".

Não use emojis.

Não exagere em gradientes.

Priorize:

hierarquia;
clareza;
densidade informacional controlada;
legibilidade;
auditabilidade;
sensação de ferramenta profissional.

Crie sidebar com:

Dashboard
Casos de Avaliação
Evidências
Datasets
Relatórios
Administração

Dentro de um valuation_case:

Resumo
Imóvel
Evidências
Dataset
Metodologias
Convergência
Laudo
Auditoria

Metodologias, Convergência e Laudo podem ficar claramente marcados como futuros nesta fase.

Não simule resultados de avaliação.

18. DASHBOARD

Crie dashboard funcional utilizando somente dados reais existentes no banco.

Cards iniciais:

Casos ativos
Evidências aguardando revisão
Datasets congelados
Casos concluídos

Se não houver registros, mostrar zero e um empty state profissional.

Não inventar números para preencher a tela.

19. CASOS DE AVALIAÇÃO

Implemente:

listar casos;

criar caso;

abrir caso;

visualizar status;

editar campos permitidos;

acessar workspace do caso.

Inclua estados de loading, error e empty state.

20. CENTRAL DE EVIDÊNCIAS

Implemente uma tela funcional para:

cadastrar fonte manualmente;

informar URL opcional;

fazer upload de artefato;

visualizar tipo da fonte;

visualizar data da captura;

visualizar hash;

visualizar status;

abrir detalhe;

revisar evidência.

No detalhe da evidência mostre visualmente a separação:

ORIGEM
ARTEFATO
EXTRAÇÃO
DADOS CANDIDATOS
VALIDAÇÃO
HISTÓRICO

Essa separação é fundamental.

21. CONGELAMENTO DO DATASET

Implemente a primeira versão do fluxo:

selecionar evidências verificadas
→ criar dataset
→ revisar elementos
→ congelar versão

Não permita incluir campo REJECTED como dado válido.

Ao congelar:

registrar frozen_at;

frozen_by;

impedir edição;

gerar hash ou assinatura determinística da composição do dataset quando possível server-side;

criar audit event.

22. RLS E SEGURANÇA

Todas as tabelas de dados de usuário/organização devem possuir RLS apropriada.

Antes de concluir, revise:

isolamento entre organizations;

roles;

Storage;

inserts;

updates;

selects;

deletes;

Edge Functions;

service role;

exposição de secrets.

Não utilize:

USING (true)

ou políticas equivalentes excessivamente permissivas em tabelas privadas.

Frontend não deve decidir autorização.

23. VALIDAÇÃO DE INPUT

Use validação frontend para UX.

Mas toda validação importante deve ocorrer também server-side.

Use schemas bem definidos, preferencialmente com Zod no TypeScript quando aplicável.

Dados externos são não confiáveis por padrão.

24. PADRÃO DE CÓDIGO

Use TypeScript strict.

Evite any.

Organize responsabilidades.

Não coloque toda lógica em componentes React.

Separe:

UI
domain
services
validation
backend

Utilize componentes reutilizáveis.

Use shadcn/ui quando apropriado.

Não refatore partes não relacionadas sem necessidade.

25. DOCUMENTAÇÃO OBRIGATÓRIA

Crie no repositório:

/docs/PRODUCT_CONSTITUTION.md
/docs/ARCHITECTURE.md
/docs/DATA_GOVERNANCE.md
/docs/SECURITY.md
/docs/DECISIONS.md
/docs/CHANGELOG.md

Crie também:

AGENTS.md

O AGENTS.md deve conter os princípios permanentes que qualquer agente de IA que futuramente trabalhe no código deve seguir.

Inclua obrigatoriamente:

Never fabricate property data.

Never fabricate evidence.

Never fabricate sources or citations.

AI output is not verified evidence.

Preserve provenance.

Preserve immutable raw evidence.

Never bypass RLS.

Never expose secrets in frontend.

Never silently modify frozen datasets.

Never present placeholder/mock values as real.

State uncertainty explicitly.

Prefer "unknown" over invented information.

Do not implement valuation formulas without a documented technical specification.

Every future valuation engine must be deterministic/reproducible given the same model version and dataset version, except where stochastic behavior is explicitly documented.

Changes affecting methodology must be versioned and auditable.

26. FUTURE ARCHITECTURE — DOCUMENT ONLY

Não implemente ainda, mas registre em ARCHITECTURE.md que planejamos incorporar futuramente:

PostGIS;

análise espacial;

pgvector;

RAG com documentação autorizada;

conectores de fontes imobiliárias;

normalização de endereço;

deduplicação de anúncios;

histórico de ofertas;

Method Engine A: tratamento por fatores;

Method Engine B: inferência estatística;

Method Engine C: AVM;

XGBoost;

CatBoost;

Random Forest;

ensemble;

SHAP;

conformal prediction;

model registry;

model cards;

validação temporal out-of-sample;

engine de convergência;

geração de laudo.

Não implemente nenhuma dessas tecnologias prematuramente nesta fase.

27. TESTES E VERIFICAÇÃO

Teste de verdade aquilo que for possível testar no ambiente.

Verifique pelo menos:

autenticação;

criação de caso;

isolamento de dados;

upload de evidência;

criação de fonte;

fluxo de validação;

criação do dataset;

congelamento;

tentativa de edição de dataset congelado;

audit log;

principais RLS policies.

Não declare que algo foi testado se não tiver sido realmente executado.

Se algum teste não puder ser realizado pelo ambiente, informe explicitamente.

28. SEM MOCK DATA ENGANOSO

Não insira dados fictícios na produção para deixar dashboard bonito.

Se precisar criar fixtures de desenvolvimento, identifique-as explicitamente como DEMO e mantenha separadas da experiência real.

Preferência: trabalhar com empty states.

29. CRITÉRIOS DE ACEITE DESTA FASE

Considerarei esta fase concluída quando houver:

autenticação funcional;

isolamento multi-tenant;

estrutura de organizações e roles;

criação de valuation_case;

cadastro básico do imóvel;

Evidence Engine funcional;

upload privado de artefatos;

hash/proveniência;

extração estruturada preparada;

revisão/validação de campos;

dataset versionado;

congelamento imutável;

audit trail;

RLS revisada;

UI profissional;

documentação técnica;

nenhuma IA gerando fatos automaticamente;

nenhuma avaliação imobiliária fictícia.

30. RESPOSTA AO FINAL DA IMPLEMENTAÇÃO

Quando terminar, não responda apenas "done".

Entregue um relatório estruturado com:

A. O que foi efetivamente implementado.

B. O que não foi implementado.

C. Tabelas e entidades criadas.

D. Migrations criadas/aplicadas.

E. RLS policies implementadas.

F. Storage buckets e políticas.

G. Edge Functions criadas.

H. Arquivos principais criados ou modificados.

I. Testes realmente executados e seus resultados.

J. Testes que NÃO puderam ser realizados.

K. Vulnerabilidades, riscos ou pendências encontrados.

L. Passos manuais que eu preciso executar.

M. Decisões arquiteturais tomadas além das que pedi, com justificativa.

N. Qual seria o próximo menor incremento funcional recomendado.

IMPORTANTE:

Não esconda erros.
Não diga que algo funciona sem ter evidência.
Não faça afirmações vagas como "security is production ready".
Informe precisamente o que foi verificado.

Execute agora esta primeira fase.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://truthstone-eval.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/457e1cea-66ae-4d0c-b5fe-791cf4038bd5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
