import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  ACCESS_STATUS_LABEL,
  NORMATIVE_STRENGTH_LABEL,
  RELATIONSHIP_LABEL,
  VERIFICATION_LABEL,
} from "@/lib/domain/methodology";

type Tone = "default" | "secondary" | "outline" | "destructive";

/** Tom visual por status de governança. Nenhum status implica autorização de cálculo. */
export const SPEC_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "secondary",
  IN_REVIEW: "outline",
  OPEN: "outline",
  UNDER_REVIEW: "outline",
  APPROVED: "default",
  IMPLEMENTED: "default",
  REJECTED: "destructive",
  SUPERSEDED: "outline",
  WITHDRAWN: "outline",
  RETIRED: "outline",
};

export function SpecStatusBadge({ status }: { status: string }) {
  return <Badge variant={SPEC_STATUS_TONE[status] ?? "outline"}>{status}</Badge>;
}

export function AccessStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "METADATA_ONLY" ? "secondary" : "outline"}>
      {ACCESS_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function VerificationBadge({ type }: { type: string }) {
  return <Badge variant="outline">{VERIFICATION_LABEL[type] ?? type}</Badge>;
}

export function NormativeStrengthBadge({ strength }: { strength: string }) {
  return (
    <Badge variant={strength === "INTERNAL_CONTROL" ? "secondary" : "outline"}>
      {NORMATIVE_STRENGTH_LABEL[strength] ?? strength}
    </Badge>
  );
}

export function RelationshipLabel({ relationship }: { relationship: string }) {
  return (
    <span className="text-xs text-muted-foreground">
      {RELATIONSHIP_LABEL[relationship] ?? relationship}
    </span>
  );
}

/** Hash exibido integralmente: verificação de integridade é conferível pelo usuário. */
export function HashRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 text-xs">
      <span className="label-meta">{label}</span>
      <span className="mono-value break-all text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export function ChecklistRow({
  ok,
  children,
}: {
  ok: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        aria-hidden
        className={
          ok
            ? "mt-0.5 size-2 shrink-0 rounded-full bg-primary"
            : "mt-0.5 size-2 shrink-0 rounded-full bg-destructive"
        }
      />
      <span className={ok ? "text-muted-foreground" : "text-foreground"}>{children}</span>
    </li>
  );
}
