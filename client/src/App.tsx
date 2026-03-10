import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import EntityPage from "@/pages/entity";
import FeesPage from "@/pages/fees";
import AccountsPage from "@/pages/accounts";
import RulesPage from "@/pages/rules";
import AmortTablePage from "@/pages/amort-table";
import VouchersPage from "@/pages/vouchers";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/entities" component={EntityPage} />
      <Route path="/fees" component={FeesPage} />
      <Route path="/accounts" component={AccountsPage} />
      <Route path="/rules" component={RulesPage} />
      <Route path="/amort-table" component={AmortTablePage} />
      <Route path="/vouchers" component={VouchersPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

const sidebarStyle = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3rem",
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center gap-2 p-2 border-b shrink-0">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
