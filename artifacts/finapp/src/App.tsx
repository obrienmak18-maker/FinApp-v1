import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useAppContext } from "./context/AppContext";

import Layout from "./components/Layout";
import Dashboard from "./pages/dashboard";
import Onboarding from "./pages/onboarding";
import Lock from "./pages/lock";
import Transactions from "./pages/transactions";
import Budgets from "./pages/budgets";
import Projects from "./pages/projects";
import AIChat from "./pages/ai-chat";
import Sync from "./pages/sync";
import Settings from "./pages/settings";

const queryClient = new QueryClient();

function AppRoutes() {
  const { isFirstRun, isLoading, isLocked } = useAppContext();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isFirstRun) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  if (isLocked) {
    return (
      <Routes>
        <Route path="/lock" element={<Lock />} />
        <Route path="*" element={<Navigate to="/lock" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/ai-chat" element={<AIChat />} />
        <Route path="/sync" element={<Sync />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
              {/* Animated background orbs */}
              <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-orb opacity-40 dark:opacity-20" />
                <div className="absolute top-1/2 right-1/4 w-80 h-80 bg-violet-500/15 rounded-full blur-3xl animate-orb-2 opacity-30 dark:opacity-15" />
                <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-orb-3 opacity-20 dark:opacity-10" />
              </div>
              <div className="relative z-10">
                <AppRoutes />
              </div>
            </div>
          </BrowserRouter>
        </AppProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
