import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useAppContext } from '../context/AppContext';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';
import { Eye, EyeOff, Info, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InfoModal from '../components/InfoModal';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Dashboard() {
  const { settings } = useAppContext();
  const defaultCurrency = settings?.defaultCurrency || 'EUR';
  const [hideBalance, setHideBalance] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const balance = transactions.reduce((acc, t) =>
    t.type === 'revenu' ? acc + t.montantConverti : acc - t.montantConverti, 0);

  const thisMonthRevenu = transactions
    .filter(t => t.type === 'revenu' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
    .reduce((s, t) => s + t.montantConverti, 0);

  const thisMonthDepense = transactions
    .filter(t => t.type === 'depense' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
    .reduce((s, t) => s + t.montantConverti, 0);

  // 6-month chart data
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i);
    const m = d.getMonth();
    const y = d.getFullYear();
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    const filtered = transactions.filter(t => {
      const td = new Date(t.date);
      return td >= start && td <= end;
    });
    const revenus = filtered.filter(t => t.type === 'revenu').reduce((s, t) => s + t.montantConverti, 0);
    const depenses = filtered.filter(t => t.type === 'depense').reduce((s, t) => s + t.montantConverti, 0);
    return {
      name: format(d, 'MMM', { locale: fr }),
      Revenus: parseFloat(revenus.toFixed(2)),
      Dépenses: parseFloat(depenses.toFixed(2)),
    };
  });

  // Top spending categories
  const catDeps: Record<string, number> = {};
  transactions
    .filter(t => t.type === 'depense' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
    .forEach(t => { catDeps[t.categorie] = (catDeps[t.categorie] || 0) + t.montantConverti; });
  const topCats = Object.entries(catDeps).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCat = topCats[0]?.[1] || 1;

  // Active budgets with overflow check
  const activeBudgets = budgets.filter(b => b.mois === currentMonth + 1 && b.annee === currentYear);

  const fmt = (n: number) => {
    if (hideBalance) return '••••';
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="p-4 md:p-6 animate-fadeUp space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Bonjour, {settings?.username || 'vous'}</p>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setShowInfo(true)} data-testid="btn-info">
          <Info className="h-4 w-4" />
        </Button>
      </header>

      {/* Balance Card */}
      <div className="p-6 rounded-2xl bg-primary/10 border border-primary/20 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground font-medium">Solde total</p>
            <button onClick={() => setHideBalance(h => !h)} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="btn-toggle-balance">
              {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-4xl font-bold tracking-tight" data-testid="balance-amount">
            {fmt(balance)} <span className="text-xl font-medium text-muted-foreground">{defaultCurrency}</span>
          </p>
        </div>
      </div>

      {/* Mini cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm" data-testid="card-revenus">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <p className="text-xs text-muted-foreground">Revenus ce mois</p>
          </div>
          <p className="text-lg font-bold text-emerald-500">{fmt(thisMonthRevenu)} <span className="text-xs font-normal">{defaultCurrency}</span></p>
        </div>
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm" data-testid="card-depenses">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <p className="text-xs text-muted-foreground">Dépenses ce mois</p>
          </div>
          <p className="text-lg font-bold text-red-500">{fmt(thisMonthDepense)} <span className="text-xs font-normal">{defaultCurrency}</span></p>
        </div>
      </div>

      {/* 6-month chart */}
      <div className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-card-border">
        <h2 className="text-sm font-semibold mb-4 text-muted-foreground">Évolution 6 mois</h2>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="gradRevenu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradDepense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--card-border))', borderRadius: '8px', fontSize: 12 }}
              formatter={(v: number) => [`${v.toFixed(2)} ${defaultCurrency}`, undefined]}
            />
            <Area type="monotone" dataKey="Revenus" stroke="#10b981" strokeWidth={2} fill="url(#gradRevenu)" dot={false} />
            <Area type="monotone" dataKey="Dépenses" stroke="#ef4444" strokeWidth={2} fill="url(#gradDepense)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top categories */}
      {topCats.length > 0 && (
        <div className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-card-border">
          <h2 className="text-sm font-semibold mb-4 text-muted-foreground">Top dépenses ce mois</h2>
          <div className="space-y-3">
            {topCats.map(([cat, amount]) => (
              <div key={cat} data-testid={`top-cat-${cat}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{cat}</span>
                  <span className="text-muted-foreground">{amount.toFixed(2)} {defaultCurrency}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all"
                    style={{ width: `${(amount / maxCat) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active budgets */}
      {activeBudgets.length > 0 && (
        <div className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-card-border">
          <h2 className="text-sm font-semibold mb-4 text-muted-foreground">Budgets actifs</h2>
          <div className="space-y-3">
            {activeBudgets.map(b => {
              const actual = transactions
                .filter(t => t.type === 'depense' && t.categorie === b.categorie && new Date(t.date).getMonth() + 1 === b.mois && new Date(t.date).getFullYear() === b.annee)
                .reduce((s, t) => s + t.montantConverti, 0);
              const pct = Math.min((actual / b.plafond) * 100, 100);
              const exceeded = actual > b.plafond;
              return (
                <div key={b.id} data-testid={`budget-card-${b.id}`}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-1.5">
                      {exceeded && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                      <span className={`font-medium ${exceeded ? 'text-red-500' : ''}`}>{b.categorie}</span>
                    </div>
                    <span className="text-muted-foreground">{actual.toFixed(0)} / {b.plafond.toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {transactions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <p>Aucune donnée. Commencez par ajouter une transaction !</p>
        </div>
      )}

      <InfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="Tableau de bord"
        description="Vue d'ensemble de vos finances: solde total, revenus/dépenses du mois, évolution sur 6 mois et top catégories de dépenses."
      />
    </div>
  );
}
