import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-border pb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          {eyebrow ? <p className="label-meta">{eyebrow}</p> : null}
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{title}</h1>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function SectionTitle({
  step,
  title,
  description,
}: {
  step?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      {step ? (
        <span className="mono-value rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 text-muted-foreground">
          {step}
        </span>
      ) : null}
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function DataField({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="min-w-0">
      <p className="label-meta">{label}</p>
      <p
        className={
          empty
            ? "mt-0.5 text-sm text-muted-foreground italic"
            : mono
              ? "mono-value mt-0.5 break-all text-foreground"
              : "mt-0.5 text-sm break-words text-foreground"
        }
      >
        {empty ? "não informado" : value}
      </p>
    </div>
  );
}

export function GovernanceNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-sm border-l-2 border-info/50 bg-info/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
