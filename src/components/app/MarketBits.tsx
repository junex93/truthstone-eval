import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  ADDRESS_NORMALIZATION_STATUS_LABELS,
  COMPARABLE_CANDIDATE_STATUS_LABELS,
  COMPARABLE_INCLUSION_STATUS_LABELS,
  MARKET_OBSERVATION_STATUS_LABELS,
  MARKET_OBSERVATION_TYPE_LABELS,
  TRANSACTION_EVIDENCE_STATUS_LABELS,
  TRANSACTION_OBSERVATION_TYPES,
  VALUE_ORIGIN_LABELS,
  type AddressNormalizationStatus,
  type ComparableCandidateStatus,
  type ComparableInclusionStatus,
  type MarketObservationStatus,
  type MarketObservationType,
  type TransactionEvidenceStatus,
  type ValueOrigin,
} from "@/lib/domain/constants";
import {
  formatDate,
  formatMoney,
  formatUnitPrice,
  NOT_INFORMED,
  type CompletenessResult,
} from "@/lib/domain/derivation";

/**
 * Elementos de leitura do acervo de mercado. Nenhum deles calcula valor: apenas
 * exibem o que foi observado, com a natureza do dado sempre declarada.
 */

export function ObservationTypeBadge({ type }: { type: string }) {
  const isTransaction = TRANSACTION_OBSERVATION_TYPES.includes(type as MarketObservationType);
  return (
    <Badge variant={isTransaction ? "default" : "secondary"}>
      {MARKET_OBSERVATION_TYPE_LABELS[type as MarketObservationType] ?? type}
    </Badge>
  );
}

export function ObservationStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline">
      {MARKET_OBSERVATION_STATUS_LABELS[status as MarketObservationStatus] ?? status}
    </Badge>
  );
}

/** REMOVIDO nunca é apresentado como vendido. */
export function StatusCaveat({ status }: { status: string }) {
  if (status !== "REMOVED" && status !== "EXPIRED" && status !== "INACTIVE") return null;
  return (
    <p className="text-xs text-muted-foreground">
      Anúncio fora do ar. Isso não constitui evidência de venda: sem documento de transação, o
      desfecho permanece desconhecido.
    </p>
  );
}

export function EvidenceStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-muted-foreground">{NOT_INFORMED}</span>;
  return (
    <Badge variant="outline">
      {TRANSACTION_EVIDENCE_STATUS_LABELS[status as TransactionEvidenceStatus] ?? status}
    </Badge>
  );
}

export function AddressStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  return (
    <Badge variant="outline">
      {ADDRESS_NORMALIZATION_STATUS_LABELS[status as AddressNormalizationStatus] ?? status}
    </Badge>
  );
}

export function ValueOriginTag({ origin }: { origin: string }) {
  return (
    <span className="mono-value text-xs text-muted-foreground">
      {VALUE_ORIGIN_LABELS[origin as ValueOrigin] ?? origin}
    </span>
  );
}

export function CandidateStatusBadge({
  candidateStatus,
  inclusionStatus,
}: {
  candidateStatus: string;
  inclusionStatus: string;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary">
        {COMPARABLE_CANDIDATE_STATUS_LABELS[candidateStatus as ComparableCandidateStatus] ??
          candidateStatus}
      </Badge>
      <Badge variant={inclusionStatus === "INCLUDED" ? "default" : "outline"}>
        {COMPARABLE_INCLUSION_STATUS_LABELS[inclusionStatus as ComparableInclusionStatus] ??
          inclusionStatus}
      </Badge>
    </span>
  );
}

/**
 * Preço com natureza declarada. Preço pedido e preço transacionado nunca ocupam
 * a mesma linha nem se substituem.
 */
export function PriceBlock({
  observation,
  askingPerArea,
  transactionPerArea,
  areaBasisLabel,
}: {
  observation: {
    currency_code?: string | null;
    asking_price?: number | null;
    transaction_price?: number | null;
    asking_monthly_rent?: number | null;
    contracted_monthly_rent?: number | null;
  };
  askingPerArea: number | null;
  transactionPerArea: number | null;
  areaBasisLabel: string;
}) {
  const currency = observation.currency_code ?? "BRL";
  const rows: { label: string; value: string; unit?: string }[] = [];

  if (observation.asking_price !== null && observation.asking_price !== undefined) {
    rows.push({
      label: "Preço pedido",
      value: formatMoney(observation.asking_price, currency),
      unit: formatUnitPrice(askingPerArea, currency),
    });
  }
  if (observation.transaction_price !== null && observation.transaction_price !== undefined) {
    rows.push({
      label: "Preço transacionado",
      value: formatMoney(observation.transaction_price, currency),
      unit: formatUnitPrice(transactionPerArea, currency),
    });
  }
  if (observation.asking_monthly_rent !== null && observation.asking_monthly_rent !== undefined) {
    rows.push({
      label: "Aluguel pedido",
      value: `${formatMoney(observation.asking_monthly_rent, currency)}/mês`,
    });
  }
  if (
    observation.contracted_monthly_rent !== null &&
    observation.contracted_monthly_rent !== undefined
  ) {
    rows.push({
      label: "Aluguel contratado",
      value: `${formatMoney(observation.contracted_monthly_rent, currency)}/mês`,
    });
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Preço {NOT_INFORMED.toLowerCase()}.</p>;
  }

  return (
    <dl className="space-y-2">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</dt>
          <dd className="text-sm">
            {row.value}
            {row.unit ? (
              <span className="ml-2 text-xs text-muted-foreground">
                {row.unit} · base: {areaBasisLabel}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Completude é contagem de informação disponível. Não é confiança nem qualidade. */
export function CompletenessPanel({
  result,
  title = "Completude de informação",
}: {
  result: CompletenessResult;
  title?: string;
}) {
  return (
    <div className="panel space-y-3 p-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">
          {result.label}. Completude mede disponibilidade de informação — não é confiança,
          qualidade, probabilidade nem escore.
        </p>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {result.items.map((item) => (
          <li key={item.label} className="text-xs text-muted-foreground">
            <span className="mono-value mr-2">
              {item.notApplicable ? "n/a" : item.available ? "sim" : "não"}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ObservationDates({
  observation,
}: {
  observation: {
    observation_date?: string | null;
    publication_date?: string | null;
    transaction_date?: string | null;
  };
}) {
  return (
    <p className="text-xs text-muted-foreground">
      Observação: {formatDate(observation.observation_date)} · Publicação:{" "}
      {formatDate(observation.publication_date)} · Transação:{" "}
      {formatDate(observation.transaction_date)}
    </p>
  );
}

export function InlineNote({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
