/**
 * Identidade documental esperada das fontes normativas reais.
 *
 * Isto NÃO é conteúdo normativo verificado nem claim: é apenas o material de
 * conferência que o revisor humano compara contra o documento aberto. Nenhum
 * campo aqui satisfaz tema, aprova regra ou preenche o cadastro sozinho.
 */
export interface ExpectedSourceIdentityField {
  label: string;
  expected: string;
}

export interface ExpectedSourceIdentity {
  reference: string;
  expectedFileName: string;
  fields: ExpectedSourceIdentityField[];
  note?: string;
}

export const EXPECTED_SOURCE_IDENTITY: Record<string, ExpectedSourceIdentity> = {
  "NBR 14653-1": {
    reference: "ABNT NBR 14653-1:2019",
    expectedFileName: "1016407685-ABNT-NBR-14653-1-Procedimentos-Gerais.pdf",
    fields: [
      { label: "Número da norma", expected: "ABNT NBR 14653-1" },
      { label: "Parte", expected: "Parte 1 — Procedimentos gerais" },
      { label: "Título", expected: "Avaliação de bens — Parte 1: Procedimentos gerais" },
      { label: "Emissor", expected: "ABNT — Associação Brasileira de Normas Técnicas" },
      { label: "Edição", expected: "Segunda edição: 27.06.2019" },
      { label: "Data de publicação", expected: "27.06.2019" },
      { label: "Versão corrigida", expected: "20.08.2019" },
      { label: "Idioma", expected: "Português (Brasil)" },
    ],
  },
  "NBR 14653-2": {
    reference: "ABNT NBR 14653-2:2011",
    expectedFileName: "622822811-NBR-14653-2-2011.pdf",
    fields: [
      { label: "Número da norma", expected: "ABNT NBR 14653-2" },
      { label: "Parte", expected: "Parte 2 — Imóveis urbanos" },
      { label: "Título", expected: "Avaliação de bens — Parte 2: Imóveis urbanos" },
      { label: "Emissor", expected: "ABNT — Associação Brasileira de Normas Técnicas" },
      { label: "Edição", expected: "Segunda edição: 03.02.2011" },
      { label: "Data de publicação", expected: "03.02.2011" },
      { label: "Válida a partir de", expected: "03.03.2011" },
      { label: "Idioma", expected: "Português (Brasil)" },
    ],
    note: "Se observável no documento, a segunda edição substitui a edição anterior. Confira no próprio arquivo; não registre o que não estiver visível.",
  },
};

/** Itens de conferência visual do conteúdo. Todos precisam ser afirmados pelo revisor. */
export const CONTENT_CHECK_ITEMS: { key: string; label: string }[] = [
  { key: "MATCHES_SOURCE", label: "O arquivo corresponde à fonte identificada no cadastro." },
  { key: "LEGIBLE", label: "O documento está legível e suficientemente íntegro para leitura." },
  { key: "EDITION", label: "O conteúdo pertence à edição identificada nos metadados." },
  { key: "NO_PART_SWAP", label: "Não houve troca de Parte 1 por Parte 2 (ou vice-versa)." },
  { key: "HASH_VALID", label: "A integridade criptográfica exibida continua válida (SHA-256 do servidor)." },
];
