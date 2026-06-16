import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, List, PieChart, Target, MessageSquare, Settings, RefreshCw, TrendingUp } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import FAB from './FAB';

const navItems = [
  { path: '/dashboard', icon: Home, label: 'Tableau de bord' },
  { path: '/transactions', icon: List, label: 'Transactions' },
  { path: '/budgets', icon: PieChart, label: 'Budgets' },
  { path: '/projects', icon: Target, label: 'Projets' },
  { path: '/ai-chat', icon: MessageSquare, label: 'Assistant IA' },
  { path: '/sync', icon: RefreshCw, label: 'Synchronisation' },
  { path: '/settings', icon: Settings, label: 'Paramètres' },
];

const mobileNavItems = navItems;

const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/transactions': 'Transactions',
  '/budgets': 'Budgets',
  '/projects': 'Projets',
  '/ai-chat': 'Assistant IA',
  '/sync': 'Synchronisation',
  '/settings': 'Paramètres',
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useAppContext();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  const pageLabel = PAGE_LABELS[location.pathname] || 'FinApp';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-60 flex-col glass-strong border-r border-card-border/60 flex-shrink-0 animate-slideRight z-20">
        {/* Logo */}
        <div className="p-5 pb-4 border-b border-card-border/40">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/40">
                f
              </div>
              <div className="absolute -inset-1 bg-primary/20 rounded-xl blur-md -z-10" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight leading-none">FinApp</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Gestion privée</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item, i) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{ animationDelay: `${i * 40}ms` }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 animate-slideRight group ${
                  active
                    ? 'bg-primary text-primary-foreground nav-active-glow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
                data-testid={`nav-${item.path.replace('/', '')}`}
              >
                <item.icon className={`h-4 w-4 shrink-0 transition-transform duration-200 ${active ? '' : 'group-hover:scale-110'}`} />
                <span className="truncate">{item.label}</span>
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground/70 shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User info at bottom */}
        <div className="p-4 border-t border-card-border/40 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Connecté en tant que</p>
          <p className="text-sm font-semibold truncate">{settings?.username || 'Vous'}</p>
          <p className="text-[11px] text-muted-foreground">Devise : {settings?.defaultCurrency || 'EUR'}</p>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* Desktop top bar */}
        <header className="hidden lg:flex items-center justify-between px-6 py-3 border-b border-card-border/40 glass-strong z-10 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest font-medium">
            <span>FINAPP</span>
            <span className="text-card-border">/</span>
            <span className="text-foreground font-semibold">{pageLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-muted-foreground">Local-first · Données sécurisées</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0" key={location.pathname}>
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 glass-strong border-t border-card-border/60 flex items-center overflow-x-auto px-1 z-30">
        {mobileNavItems.map(item => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-shrink-0 min-w-[4.5rem] h-full gap-1 px-2 transition-all duration-200 ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
              data-testid={`mobile-nav-${item.path.replace('/', '')}`}
            >
              <div className={`p-1 rounded-lg transition-all ${active ? 'bg-primary/15' : ''}`}>
                <item.icon className={`h-5 w-5 transition-all duration-200 ${active ? 'scale-110' : ''}`} />
              </div>
              <span className={`text-[8px] font-medium leading-none ${active ? 'opacity-100' : 'opacity-60'}`}>
                {item.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* FAB (transactions page only) */}
      <FAB />
    </div>
  );
}
