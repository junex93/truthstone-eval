/**
 * BATCH 01 — proposta assistida de localizadores e claims candidatas
 * (temas T01, T04 e T07 da especificação "MCDDM — Tratamento por Fatores").
 *
 * NATUREZA DESTE ARQUIVO: sugestão de trabalho, não afirmação normativa.
 * Nada aqui entra no acervo sem que:
 *   1. a organização tenha documento autorizado da fonte (bucket privado);
 *   2. um revisor humano registre METADATA_VERIFIED e CONTENT_VERIFIED;
 *   3. o localizador seja criado e conferido (LOCATOR_VERIFIED);
 *   4. a claim candidata seja aceita por revisor distinto de quem propôs.
 * O banco recusa qualquer atalho nessas quatro etapas.
 *
 * Os trechos abaixo foram lidos das cópias autorizadas presentes nesta
 * organização — Parte 1 pela camada de texto do PDF, Parte 2 por OCR de página
 * digitalizada. OCR erra: cada trecho é CANDIDATO e precisa de conferência
 * visual contra o documento antes de qualquer aceite.
 */
import type { ClaimExtractionMethod, MethodologyClaimKind } from "@/lib/domain/methodology";

/** Identificadores globais estáveis das duas fontes do Batch 01. */
export const BATCH01_SOURCE_IDS = {
  NBR_14653_1: "11111111-0000-4000-8000-000000000002",
  NBR_14653_2: "11111111-0000-4000-8000-000000000003",
} as const;

export const FACTORS_SPECIFICATION_ID = "33333333-0000-4000-8000-000000000001";

export interface Batch01LocatorSuggestion {
  key: string;
  locatorType: "CLAUSE" | "SECTION" | "ANNEX" | "TABLE";
  section?: string;
  clause?: string;
  page?: string;
  tableReference?: string;
  /** Trecho mínimo necessário para ancorar a claim. */
  supportExcerpt: string;
  notes: string;
}

export interface Batch01ClaimSuggestion {
  claimCode: string;
  requirementCode: "T01_DEFINITION_MCDDM" | "T04_APPLICABILITY" | "T07_SAMPLE_REQUIREMENTS";
  claimKind: MethodologyClaimKind;
  statement: string;
  verbatimExcerpt?: string;
  numericPayload?: Record<string, unknown>;
  deferredTarget?: string;
  extractionMethod: ClaimExtractionMethod;
  reviewerAlerts: string[];
}

export interface Batch01Item {
  sourceId: string;
  locator: Batch01LocatorSuggestion;
  claim: Batch01ClaimSuggestion;
}

const OCR_ALERT =
  "Trecho obtido por OCR de página digitalizada: conferir caractere por caractere contra o PDF antes do aceite.";
const WATERMARK_PART1 =
  'A cópia desta organização traz marca d\'água "Exemplar para uso exclusivo - INSTITUTO RUI BARBOSA - IRB": confirmar a base de acesso registrada.';
const WATERMARK_PART2 =
  "A cópia desta organização traz marca d'água de exemplar de uso exclusivo nominal a pessoa física: confirmar a base de acesso registrada.";
const CROSSREF_ALERT =
  "A Parte 2:2011 remete a 8.2.1 da ABNT NBR 14653-1:2001, edição substituída pela 14653-1:2019, onde o método comparativo direto é 7.2.1. A correspondência é interpretação e precisa de crosswalk explícito, não de reescrita do texto.";

/** T01 — definição e posição metodológica do MCDDM. */
const T01: Batch01Item[] = [
  {
    sourceId: BATCH01_SOURCE_IDS.NBR_14653_1,
    locator: {
      key: "P1-7.2.1",
      locatorType: "CLAUSE",
      clause: "7.2.1",
      section: "7.2 Métodos para identificar o valor de um bem, de seus frutos e direitos",
      page: "14",
      supportExcerpt:
        "7.2.1 Método comparativo direto de dados de mercado — Identifica o valor de mercado do bem por meio de tratamento técnico dos atributos dos elementos comparáveis, constituintes da amostra.",
      notes:
        "ABNT NBR 14653-1:2019, segunda edição, versão corrigida 20.08.2019. Camada de texto do PDF.",
    },
    claim: {
      claimCode: "B01-T01-C1",
      requirementCode: "T01_DEFINITION_MCDDM",
      claimKind: "DEFINITION",
      statement:
        "O método comparativo direto de dados de mercado identifica o valor de mercado por tratamento técnico dos atributos dos elementos comparáveis que constituem a amostra.",
      verbatimExcerpt:
        "Identifica o valor de mercado do bem por meio de tratamento técnico dos atributos dos elementos comparáveis, constituintes da amostra.",
      extractionMethod: "PDF_TEXT_LAYER",
      reviewerAlerts: [WATERMARK_PART1],
    },
  },
  {
    sourceId: BATCH01_SOURCE_IDS.NBR_14653_2,
    locator: {
      key: "P2-B.1",
      locatorType: "ANNEX",
      section: "Anexo B (normativo) — Procedimentos para a utilização de tratamento por fatores",
      clause: "B.1",
      page: "40",
      supportExcerpt:
        "Neste tratamento de dados, aplicável ao Método Comparativo Direto de Dados de Mercado, é admitida a priori a validade da existência de relações fixas entre os atributos específicos e os respectivos preços.",
      notes: "ABNT NBR 14653-2:2011, Anexo B, obtido por OCR (página 40 impressa).",
    },
    claim: {
      claimCode: "B01-T01-C2",
      requirementCode: "T01_DEFINITION_MCDDM",
      claimKind: "NORMATIVE_TEXT",
      statement:
        "O tratamento por fatores é um tratamento de dados aplicável ao método comparativo direto de dados de mercado, que admite a priori a existência de relações fixas entre atributos específicos e os respectivos preços.",
      verbatimExcerpt:
        "Neste tratamento de dados, aplicável ao Método Comparativo Direto de Dados de Mercado, é admitida a priori a validade da existência de relações fixas entre os atributos específicos e os respectivos preços.",
      extractionMethod: "OCR_ASSISTED",
      reviewerAlerts: [OCR_ALERT, WATERMARK_PART2],
    },
  },
];

/** T04 — condições de aplicabilidade e limites de campo de aplicação. */
const T04: Batch01Item[] = [
  {
    sourceId: BATCH01_SOURCE_IDS.NBR_14653_2,
    locator: {
      key: "P2-B.1-campo",
      locatorType: "ANNEX",
      section: "Anexo B (normativo) — B.1 Introdução",
      clause: "B.1",
      page: "40",
      supportExcerpt:
        "Os fatores de homogeneização não podem ser utilizados fora do campo de aplicação para o qual foram calculados, em relação às características quantitativas e qualitativas do imóvel, tipologia, região e validade temporal do estudo que gerou os fatores.",
      notes: "Limite de campo de aplicação dos fatores. OCR.",
    },
    claim: {
      claimCode: "B01-T04-C1",
      requirementCode: "T04_APPLICABILITY",
      claimKind: "NORMATIVE_TEXT",
      statement:
        "Fator de homogeneização não pode ser usado fora do campo de aplicação para o qual foi calculado: tipologia, características quantitativas e qualitativas, região e validade temporal do estudo que o gerou delimitam seu uso.",
      verbatimExcerpt:
        "Os fatores de homogeneização não podem ser utilizados fora do campo de aplicação para o qual foram calculados, em relação às características quantitativas e qualitativas do imóvel, tipologia, região e validade temporal do estudo que gerou os fatores.",
      extractionMethod: "OCR_ASSISTED",
      reviewerAlerts: [OCR_ALERT],
    },
  },
  {
    sourceId: BATCH01_SOURCE_IDS.NBR_14653_2,
    locator: {
      key: "P2-B.5",
      locatorType: "ANNEX",
      section: "Anexo B — B.5 Fatores de homogeneização",
      clause: "B.5",
      page: "41",
      supportExcerpt:
        "Os fatores de homogeneização devem apresentar, para cada tipologia, os seus critérios de apuração e respectivos campos de aplicação, bem como a abrangência regional e temporal. A fonte dos fatores utilizados na homogeneização deve ser explicitada no trabalho avaliatório.",
      notes: "Procedência e escopo declarados do fator. OCR.",
    },
    claim: {
      claimCode: "B01-T04-C2",
      requirementCode: "T04_APPLICABILITY",
      claimKind: "NORMATIVE_TEXT",
      statement:
        "Cada fator de homogeneização deve declarar critério de apuração, campo de aplicação, abrangência regional e temporal, e a fonte utilizada deve ser explicitada no trabalho avaliatório.",
      verbatimExcerpt:
        "Os fatores de homogeneização devem apresentar, para cada tipologia, os seus critérios de apuração e respectivos campos de aplicação, bem como a abrangência regional e temporal.",
      extractionMethod: "OCR_ASSISTED",
      reviewerAlerts: [OCR_ALERT],
    },
  },
  {
    sourceId: BATCH01_SOURCE_IDS.NBR_14653_2,
    locator: {
      key: "P2-8.1.1",
      locatorType: "CLAUSE",
      clause: "8.1.1",
      section: "8.1 Procedimentos gerais",
      page: "13",
      supportExcerpt:
        "Para a identificação do valor de mercado, sempre que possível preferir o método comparativo direto de dados de mercado, conforme definido em 8.2.1 da ABNT NBR 14653-1:2001.",
      notes:
        "Remissão a edição substituída da Parte 1. Requer crosswalk explícito, não reescrita.",
    },
    claim: {
      claimCode: "B01-T04-C3",
      requirementCode: "T04_APPLICABILITY",
      claimKind: "DEFERRED_REFERENCE",
      statement:
        "A Parte 2:2011 condiciona a preferência pelo método comparativo direto a definição contida em outra parte da norma, citando 8.2.1 da ABNT NBR 14653-1:2001 — edição substituída. A correspondência com a 14653-1:2019 é interpretação a registrar como crosswalk.",
      verbatimExcerpt:
        "Para a identificação do valor de mercado, sempre que possível preferir o método comparativo direto de dados de mercado, conforme definido em 8.2.1 da ABNT NBR 14653-1:2001.",
      deferredTarget: "ABNT NBR 14653-1:2001, 8.2.1 (edição substituída pela 14653-1:2019, 7.2.1)",
      extractionMethod: "OCR_ASSISTED",
      reviewerAlerts: [OCR_ALERT, CROSSREF_ALERT],
    },
  },
];

/** T07 — requisitos da amostra no tratamento por fatores. */
const T07: Batch01Item[] = [
  {
    sourceId: BATCH01_SOURCE_IDS.NBR_14653_2,
    locator: {
      key: "P2-B.2",
      locatorType: "ANNEX",
      section: "Anexo B — B.2 Recomendações quanto à amostra",
      clause: "B.2",
      page: "40",
      supportExcerpt:
        "Recomenda-se que, no tratamento por fatores, a amostra seja composta por dados de mercado com características físicas, socioeconômicas e de localização as mais semelhantes possíveis entre si e em relação ao imóvel avaliando, de forma a exigir apenas pequenos ajustes na homogeneização.",
      notes: "Composição recomendada da amostra. OCR.",
    },
    claim: {
      claimCode: "B01-T07-C1",
      requirementCode: "T07_SAMPLE_REQUIREMENTS",
      claimKind: "NORMATIVE_TEXT",
      statement:
        "No tratamento por fatores, recomenda-se amostra composta por dados de mercado com características físicas, socioeconômicas e de localização as mais semelhantes possíveis entre si e em relação ao avaliando, exigindo apenas pequenos ajustes na homogeneização.",
      verbatimExcerpt:
        "Recomenda-se que, no tratamento por fatores, a amostra seja composta por dados de mercado com características físicas, socioeconômicas e de localização as mais semelhantes possíveis entre si e em relação ao imóvel avaliando, de forma a exigir apenas pequenos ajustes na homogeneização.",
      extractionMethod: "OCR_ASSISTED",
      reviewerAlerts: [OCR_ALERT],
    },
  },
  {
    sourceId: BATCH01_SOURCE_IDS.NBR_14653_2,
    locator: {
      key: "P2-B.2.2",
      locatorType: "ANNEX",
      section: "Anexo B — B.2.2",
      clause: "B.2.2",
      page: "40",
      supportExcerpt:
        "Para a utilização deste tratamento, considera-se como dado de mercado com atributos semelhantes aqueles em que cada um dos fatores de homogeneização, calculados em relação ao avaliando ou ao paradigma, estejam contidos entre 0,50 e 2,00.",
      notes: "Intervalo de semelhança por fator individual. OCR — número exige dupla conferência.",
    },
    claim: {
      claimCode: "B01-T07-C2",
      requirementCode: "T07_SAMPLE_REQUIREMENTS",
      claimKind: "NUMERIC_NORMATIVE_CANDIDATE",
      statement:
        "Dado de mercado é considerado de atributos semelhantes quando cada fator de homogeneização, calculado em relação ao avaliando ou ao paradigma, está contido no intervalo declarado no documento.",
      verbatimExcerpt:
        "cada um dos fatores de homogeneização, calculados em relação ao avaliando ou ao paradigma, estejam contidos entre 0,50 e 2,00",
      numericPayload: {
        subject: "intervalo admissível por fator individual",
        lower_bound: 0.5,
        upper_bound: 2.0,
        scope: "tratamento por fatores — semelhança de atributos",
        status: "CANDIDATE_PENDING_HUMAN_DOUBLE_CHECK",
      },
      extractionMethod: "OCR_ASSISTED",
      reviewerAlerts: [
        OCR_ALERT,
        "Número normativo: nenhum cálculo pode consumi-lo antes de aceite humano e LOCATOR_VERIFIED.",
      ],
    },
  },
  {
    sourceId: BATCH01_SOURCE_IDS.NBR_14653_2,
    locator: {
      key: "P2-Tabela3",
      locatorType: "TABLE",
      tableReference: "Tabela 3",
      section: "9.2 Grau de fundamentação — tratamento por fatores",
      page: "25",
      supportExcerpt:
        "Tabela 3 — Grau de fundamentação no caso de utilização do tratamento por fatores. Item 2: quantidade mínima de dados de mercado efetivamente utilizados — 12 (Grau III), 5 (Grau II), 3 (Grau I). Item 4: intervalo admissível de ajuste para o conjunto de fatores — 0,80 a 1,25 (III), 0,50 a 2,00 (II), 0,40 a 2,50 (I).",
      notes:
        "Tabela digitalizada: leitura por OCR de estrutura tabular é especialmente frágil. Conferência visual obrigatória célula por célula.",
    },
    claim: {
      claimCode: "B01-T07-C3",
      requirementCode: "T07_SAMPLE_REQUIREMENTS",
      claimKind: "TABLE_REFERENCE",
      statement:
        "A norma condiciona o grau de fundamentação do tratamento por fatores a uma tabela com quantidade mínima de dados de mercado efetivamente utilizados e intervalo admissível de ajuste para o conjunto de fatores, por grau.",
      verbatimExcerpt:
        "Tabela 3 - Grau de fundamentação no caso de utilização do tratamento por fatores",
      numericPayload: {
        table: "Tabela 3",
        candidate_reading: {
          minimum_market_data: { grade_III: 12, grade_II: 5, grade_I: 3 },
          admissible_adjustment_interval: {
            grade_III: [0.8, 1.25],
            grade_II: [0.5, 2.0],
            grade_I: [0.4, 2.5],
          },
          footnote:
            "No caso de utilização de menos de cinco dados de mercado, o intervalo admissível de ajuste é de 0,80 a 1,25.",
        },
        status: "CANDIDATE_PENDING_CELL_BY_CELL_HUMAN_CHECK",
      },
      extractionMethod: "OCR_ASSISTED",
      reviewerAlerts: [
        OCR_ALERT,
        "Leitura de tabela por OCR: conferir cada célula e a nota de rodapé antes de qualquer aceite.",
        "Mínimo amostral permanece proibido de uso operacional enquanto a claim não for aceita.",
      ],
    },
  },
  {
    sourceId: BATCH01_SOURCE_IDS.NBR_14653_2,
    locator: {
      key: "P2-B.3",
      locatorType: "ANNEX",
      section: "Anexo B — B.3 Saneamento da amostra",
      clause: "B.3",
      page: "40",
      supportExcerpt:
        "Após a homogeneização, devem ser utilizados critérios estatísticos consagrados de eliminação de dados discrepantes, para o saneamento da amostra. Os dados discrepantes devem ser retirados um a um, com início pelo que esteja mais distante da média.",
      notes: "Saneamento da amostra após homogeneização. OCR.",
    },
    claim: {
      claimCode: "B01-T07-C4",
      requirementCode: "T07_SAMPLE_REQUIREMENTS",
      claimKind: "NORMATIVE_TEXT",
      statement:
        "Após a homogeneização, o saneamento da amostra usa critérios estatísticos consagrados de eliminação de dados discrepantes, retirados um a um, iniciando pelo mais distante da média; admite-se reintrodução de dados antes retirados.",
      verbatimExcerpt:
        "Os dados discrepantes devem ser retirados um a um, com início pelo que esteja mais distante da média. Admite-se a reintrodução de dados anteriormente retirados no processo.",
      extractionMethod: "OCR_ASSISTED",
      reviewerAlerts: [OCR_ALERT],
    },
  },
];

export const BATCH01_ITEMS: readonly Batch01Item[] = [...T01, ...T04, ...T07];

export function batch01ItemsForSource(sourceId: string): Batch01Item[] {
  return BATCH01_ITEMS.filter((i) => i.sourceId === sourceId);
}
