import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CASE_STATUS_LABELS,
  FIELD_STATE_LABELS,
  VALIDATION_STATUS_LABELS,
  type CaseStatus,
  type FieldState,
  type ValidationStatus,
} from "@/lib/domain/constants";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "frozen";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border-strong bg-surface-muted text-muted-foreground",
  info: "border-info/30 bg-info/10 text-info",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/15 text-warning-foreground",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  frozen: "border-primary/30 bg-primary/10 text-primary",
};

function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-sm px-1.5 py-0 text-[11px] font-medium tracking-wide uppercase",
        TONE_CLASS[tone],
      )}
    >
      {children}
    </Badge>
  );
}

const CASE_TONE: Record<CaseStatus, Tone> = {
  DRAFT: "neutral",
  EVIDENCE_COLLECTION: "info",
  DATA_REVIEW: "warning",
  DATASET_FROZEN: "frozen",
  VALUATION: "info",
  REVIEW: "warning",
  COMPLETED: "success",
  ARCHIVED: "neutral",
};

export function CaseStatusBadge({ status }: { status: string }) {
  const key = status as CaseStatus;
  return <Chip tone={CASE_TONE[key] ?? "neutral"}>{CASE_STATUS_LABELS[key] ?? status}</Chip>;
}

const VALIDATION_TONE: Record<ValidationStatus, Tone> = {
  CAPTURED: "neutral",
  EXTRACTED: "info",
  PENDING_REVIEW: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
};

export function ValidationStatusBadge({ status }: { status: string }) {
  const key = status as ValidationStatus;
  return (
    <Chip tone={VALIDATION_TONE[key] ?? "neutral"}>
      {VALIDATION_STATUS_LABELS[key] ?? status}
    </Chip>
  );
}

export function FieldStateBadge({ state }: { state: string }) {
  const key = state as FieldState;
  const tone: Tone =
    key === "PRESENT" ? "info" : key === "DIVERGENT" ? "danger" : "neutral";
  return <Chip tone={tone}>{FIELD_STATE_LABELS[key] ?? state}</Chip>;
}

export function FrozenBadge({ frozen }: { frozen: boolean }) {
  return frozen ? <Chip tone="frozen">Congelado</Chip> : <Chip tone="neutral">Aberto</Chip>;
}
