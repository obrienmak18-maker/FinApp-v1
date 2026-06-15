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
        <div className="relative">
          <div className="w-12 h-12 border-2 border-primary/30 rounded-full" />
          <div className="absolute inset-0 w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
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
                {/* Primary orb — top left */}
                <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full blur-[120px] animate-orb"
                  style={{ background: 'radial-gradient(circle, hsl(239 84% 67% / 0.18), transparent 70%)' }} />
                {/* Violet orb — top right */}
                <div className="absolute top-[5%] right-[-8%] w-[400px] h-[400px] rounded-full blur-[100px] animate-orb-2"
                  style={{ background: 'radial-gradient(circle, hsl(271 91% 65% / 0.13), transparent 70%)' }} />
                {/* Teal orb — bottom center */}
                <div className="absolute bottom-[-5%] left-[40%] w-[450px] h-[450px] rounded-full blur-[130px] animate-orb-3"
                  style={{ background: 'radial-gradient(circle, hsl(239 80% 55% / 0.10), transparent 70%)' }} />
                {/* Subtle noise texture overlay */}
                <div className="absolute inset-0 opacity-[0.015]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    backgroundSize: '200px 200px',
                  }}
                />
              </div>
              <div className="relative z-10 min-h-screen">
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
