import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getWorkspace } from "@/lib/workspace.functions";

export type WorkspaceRole = "OWNER" | "ADMIN" | "VALUER" | "REVIEWER" | "VIEWER";

/** Current user, organization and role. Frontend gating is UX only — the server re-checks. */
export function useWorkspace() {
  const fetchWorkspace = useServerFn(getWorkspace);
  return useQuery({
    queryKey: ["workspace"],
    queryFn: () => fetchWorkspace(),
    staleTime: 30_000,
  });
}

export function canWrite(role: WorkspaceRole | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "VALUER";
}

export function canReview(role: WorkspaceRole | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "REVIEWER";
}

export function isAdmin(role: WorkspaceRole | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN";
}
