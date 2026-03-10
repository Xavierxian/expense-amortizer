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
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <CalendarRange className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold" data-testid="text-app-title">费用摊销系统</h2>
            <p className="text-xs text-muted-foreground">Amortization Manager</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>功能菜单</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.url}
                  >
                    <Link href={item.url} data-testid={`nav-${item.url.replace("/", "") || "home"}`}>
                      <item.icon className="w-4 h-4" />
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
