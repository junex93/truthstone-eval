import { Link, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  Database,
  FileSearch,
  FileText,
  LayoutDashboard,
  Settings,
  Layers,
  BookMarked,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Casos de Avaliação", url: "/cases", icon: Layers },
  { title: "Evidências", url: "/evidence", icon: FileSearch },
  { title: "Datasets", url: "/datasets", icon: Database },
  { title: "Metodologia", url: "/methodology", icon: BookMarked },
  { title: "Relatórios", url: "/reports", icon: FileText },
  { title: "Administração", url: "/admin", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-3 py-4">
          <Archive className="size-5 shrink-0 text-sidebar-primary" aria-hidden />
          <div className="min-w-0">
            <p className="truncate font-serif text-sm font-semibold text-sidebar-foreground">
              Inteligência Pericial
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">
              Evidence Intelligence Engine
            </p>
          </div>
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url || pathname.startsWith(`${item.url}/`)}
                    tooltip={item.title}
                  >
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4" aria-hidden />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
