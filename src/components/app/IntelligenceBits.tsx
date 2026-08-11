import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  AGE_BUCKET_LABELS,
  ATTRIBUTE_LABELS,
  coveragePercent,
  MARKET_DATA_ISSUE_SEVERITY_LABELS,
  MARKET_DATA_ISSUE_STATUS_LABELS,
  MARKET_DATA_ISSUE_TYPE_LABELS,
  READINESS_STATE_LABELS,
  SAMPLE_SELECTION_STATE_LABELS,
  type MarketIntelligenceReport,
  type ReportDistribution,
} from "@/lib/domain/intelligence";
import { formatDate, formatMoney, NOT_INFORMED } from "@/lib/domain/derivation";

/**
 * Elementos de leitura do diagnóstico de mercado. Nenhum deles produz valor,
 * ajuste ou fator: apresentam contagem, cobertura, distância, data e
 * distribuição descritiva, sempre declarando a natureza do dado.
 */

export function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="panel p-4">
      <p className="label-meta">{label}</p>
      <p className="mono-value mt-1 text-lg text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function CoverageBar({ known, verified, total }: { known: number; verified: number; total: number }) {
  const knownPct = coveragePercent(known, total) ?? 0;
  const verifiedPct = coveragePercent(verified, total) ?? 0;
  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-sm bg-surface-muted">
        <div className="relative h-full" style={{ width: `${knownPct}%` }}>
          <div className="h-full w-full bg-info/40" />
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-sm bg-surface-muted">
        <div className="h-full bg-primary" style={{ width: `${verifiedPct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        conhecido {knownPct}% · verificado {verifiedPct}% · desconhecido{" "}
        {Math.max(0, Math.round((1000 * (total - known)) / Math.max(total, 1)) / 10)}%
      </p>
    </div>
  );
}

export function AttributeCoverageTable({
  rows,
}: {
  rows: MarketIntelligenceReport["attribute_coverage"];
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sem imóveis de mercado no caso.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="label-meta py-2">Atributo</th>
            <th className="label-meta py-2">Conhecido</th>
            <th className="label-meta py-2">Verificado</th>
            <th className="label-meta py-2">Desconhecido</th>
            <th className="label-meta py-2">Divergente</th>
            <th className="label-meta py-2 w-56">Cobertura</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.attribute} className="border-b border-border/60">
              <td className="py-2">{ATTRIBUTE_LABELS[row.attribute] ?? row.attribute}</td>
              <td className="mono-value py-2">{row.known}</td>
              <td className="mono-value py-2">{row.verified}</td>
              <td className="mono-value py-2">{row.unknown}</td>
              <td className="mono-value py-2">{row.conflicting}</td>
              <td className="py-2">
                <CoverageBar known={row.known} verified={row.verified} total={row.total} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        Completude não é confiança. &quot;Conhecido&quot; significa que existe um valor observado;
        &quot;verificado&quot; significa que há campo de evidência conferido por pessoa autorizada.
      </p>
    </div>
  );
}

export function DistributionRow({
  label,
  distribution,
  unit,
}: {
  label: string;
  distribution: ReportDistribution | null;
  unit: string;
}) {
  if (!distribution || !distribution.count) {
    return (
      <div className="panel p-4">
        <p className="label-meta">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground italic">
          Sem base para distribuição — nenhum valor com área correspondente.
        </p>
      </div>
    );
  }
  const cell = (name: string, value: number | null) => (
    <div key={name}>
      <p className="label-meta">{name}</p>
      <p className="mono-value text-sm">{value === null ? NOT_INFORMED : formatMoney(value)}</p>
    </div>
  );
  return (
    <div className="panel space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label-meta">{label}</p>
        <p className="text-xs text-muted-foreground">
          {distribution.count} observações · {unit}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cell("mínimo", distribution.min)}
        {cell("Q1", distribution.q1)}
        {cell("mediana", distribution.median)}
        {cell("Q3", distribution.q3)}
        {cell("máximo", distribution.max)}
      </div>
    </div>
  );
}

export function AgeBuckets({ buckets }: { buckets: MarketIntelligenceReport["temporal"]["age_buckets"] }) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground">Sem observações datadas.</p>;
  return (
    <ul className="space-y-2">
      {buckets.map((bucket) => (
        <li key={bucket.bucket} className="flex items-center gap-3">
          <span className="w-40 text-xs text-muted-foreground">
            {AGE_BUCKET_LABELS[bucket.bucket] ?? bucket.bucket}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-sm bg-surface-muted">
            <span
              className="block h-full bg-primary/70"
              style={{ width: `${Math.round((100 * bucket.count) / total)}%` }}
            />
          </span>
          <span className="mono-value w-10 text-right text-xs">{bucket.count}</span>
        </li>
      ))}
    </ul>
  );
}

export function IssueBadges({ severity, status }: { severity: string; status: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant={severity === "BLOCKER" ? "destructive" : severity === "WARNING" ? "default" : "secondary"}>
        {MARKET_DATA_ISSUE_SEVERITY_LABELS[severity] ?? severity}
      </Badge>
      <Badge variant="outline">{MARKET_DATA_ISSUE_STATUS_LABELS[status] ?? status}</Badge>
    </span>
  );
}

export function IssueTypeLabel({ type }: { type: string }) {
  return <span>{MARKET_DATA_ISSUE_TYPE_LABELS[type] ?? type}</span>;
}

export function ReadinessBadge({ state }: { state: string }) {
  const variant =
    state === "READY_FOR_METHOD_REVIEW"
      ? "default"
      : state === "READY_WITH_WARNINGS"
        ? "secondary"
        : state === "NOT_READY"
          ? "destructive"
          : "outline";
  return <Badge variant={variant}>{READINESS_STATE_LABELS[state] ?? state}</Badge>;
}

export function SelectionStateBadge({ state }: { state: string }) {
  return (
    <Badge variant={state === "SELECTED" ? "default" : state === "EXCLUDED" ? "destructive" : "outline"}>
      {SAMPLE_SELECTION_STATE_LABELS[state] ?? state}
    </Badge>
  );
}

export function HashLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="label-meta">{label}</p>
      <p className="mono-value text-xs break-all text-muted-foreground">{value ?? NOT_INFORMED}</p>
    </div>
  );
}

export function PeriodLine({ from, to }: { from: string | null; to: string | null }) {
  return (
    <p className="text-sm text-foreground">
      {formatDate(from)} — {formatDate(to)}
    </p>
  );
}
