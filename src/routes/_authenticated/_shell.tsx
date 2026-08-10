import { useQueryClient } from "@tanstack/react-query";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { AppSidebar } from "@/components/app/AppSidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useWorkspace } from "@/hooks/use-workspace";
import { ORG_ROLE_LABELS, type OrgRole } from "@/lib/domain/constants";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_shell")({
  component: ShellLayout,
});

function ShellLayout() {
  const { data } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {data?.organization?.name ?? "Sem organização vinculada"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {data?.email ?? ""}
                {data?.role ? ` · ${ORG_ROLE_LABELS[data.role as OrgRole]}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
              <LogOut className="size-4" aria-hidden />
              Sair
            </Button>
          </header>
          <main className="flex-1 bg-background px-4 py-6 md:px-8">
            <div className="mx-auto max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
