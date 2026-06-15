import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, List, PieChart, Target, MessageSquare, Settings, RefreshCw } from 'lucide-react';
import FAB from './FAB';

const navItems = [
  { path: '/dashboard', icon: Home, label: 'Accueil' },
  { path: '/transactions', icon: List, label: 'Transactions' },
  { path: '/budgets', icon: PieChart, label: 'Budgets' },
  { path: '/projects', icon: Target, label: 'Projets' },
  { path: '/ai-chat', icon: MessageSquare, label: 'Assistant' },
  { path: '/sync', icon: RefreshCw, label: 'Sync' },
  { path: '/settings', icon: Settings, label: 'Paramètres' },
];

const mobileNavItems = navItems.slice(0, 5);

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="flex h-screen bg-transparent">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 flex-col bg-card/30 backdrop-blur-xl border-r border-card-border flex-shrink-0">
        <div className="p-5 flex items-center gap-3 border-b border-card-border">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/30">
            F
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight">FinApp</span>
            <p className="text-xs text-muted-foreground leading-none">Gestion Financière</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive(item.path)
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              data-testid={`nav-${item.path.replace('/', '')}`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-card-border">
          <p className="text-xs text-muted-foreground text-center">FinApp v1.0 · Local-First</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0" key={location.pathname}>
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/70 backdrop-blur-xl border-t border-card-border flex items-center justify-around px-1 z-30">
        {mobileNavItems.map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors ${
              isActive(item.path) ? 'text-primary' : 'text-muted-foreground'
            }`}
            data-testid={`mobile-nav-${item.path.replace('/', '')}`}
          >
            <item.icon className={`h-5 w-5 transition-all ${isActive(item.path) ? 'scale-110' : ''}`} />
            <span className="text-[9px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      {/* FAB (transactions page only) */}
      <FAB />
    </div>
  );
}
