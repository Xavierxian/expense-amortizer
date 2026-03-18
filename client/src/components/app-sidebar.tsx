import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Upload,
  Settings2,
  CalendarRange,
  BookOpen,
  FileText,
  Building2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "总览", url: "/", icon: LayoutDashboard },
  { title: "主体管理", url: "/entities", icon: Building2 },
  { title: "费用导入", url: "/fees", icon: Upload },
  { title: "摊销规则", url: "/rules", icon: Settings2 },
  { title: "月度摊销表", url: "/amort-table", icon: CalendarRange },
  { title: "科目管理", url: "/accounts", icon: BookOpen },
  { title: "凭证管理", url: "/vouchers", icon: FileText },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shadow-md flex-shrink-0">
            <CalendarRange className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-sidebar-foreground tracking-wide" data-testid="text-app-title">费用摊销系统</h2>
            <p className="text-xs text-sidebar-foreground/50 mt-0.5">Amortization Manager</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold tracking-widest text-sidebar-foreground/40 uppercase px-3 mb-1">功能菜单</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={`
                        relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                        ${isActive
                          ? "bg-sidebar-primary text-white shadow-sm"
                          : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }
                      `}
                    >
                      <Link href={item.url} data-testid={`nav-${item.url.replace("/", "") || "home"}`}>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white/80 rounded-r-full" />
                        )}
                        <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-sidebar-foreground/80"}`} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 py-3 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/30 text-center">费用摊销系统 v1.0</p>
      </SidebarFooter>
    </Sidebar>
  );
}
