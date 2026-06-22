import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useAppContext } from '../context/AppContext';
import MiniAreaChart, { ChartDataPoint } from '../components/MiniAreaChart';
import {
  Eye, EyeOff, Info, TrendingUp, TrendingDown,
  AlertTriangle, BarChart2, Wallet, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import InfoModal from '../components/InfoModal';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

/* ── Custom Tooltip ── */
function ChartTooltip({ active, payload, label, currency }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs space-y-1 shadow-xl">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-semibold text-foreground ml-auto pl-4">{p.value.toFixed(2)} {currency}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({
  label, value, currency, icon: Icon, iconBg, iconColor, trend, delay = 0
}: {
  label: string; value: number; currency: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  trend?: number; delay?: number;
}) {
  const isPositive = trend === undefined || trend >= 0;
  return (
    <div
      className="glass rounded-2xl p-5 flex items-start justify-between gap-4 hover:scale-[1.02] transition-transform duration-200 animate-fadeUp"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">{label}</p>
        <p className={`text-2xl font-bold truncate ${iconColor}`}>
          {value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="text-sm font-medium ml-1.5 opacity-70">{currency}</span>
        </p>
        {trend !== undefined && (
          <p className={`text-xs mt-1.5 flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}% vs mois dernier
          </p>
        )}
      </div>
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0 shadow-lg`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { settings } = useAppContext();
  const defaultCurrency = settings?.defaultCurrency || 'EUR';
  const [hideBalance, setHideBalance] = useState(false);

  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const balance = transactions.reduce((acc, t) =>
    t.type === 'revenu' ? acc + t.montantConverti : acc - t.montantConverti, 0);

  const thisMonthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const prevMonthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  });

  const thisRevenu = thisMonthTx.filter(t => t.type === 'revenu').reduce((s, t) => s + t.montantConverti, 0);
  const thisDepense = thisMonthTx.filter(t => t.type === 'depense').reduce((s, t) => s + t.montantConverti, 0);
  const prevRevenu = prevMonthTx.filter(t => t.type === 'revenu').reduce((s, t) => s + t.montantConverti, 0);
  const prevDepense = prevMonthTx.filter(t => t.type === 'depense').reduce((s, t) => s + t.montantConverti, 0);

  const revenuTrend = prevRevenu > 0 ? ((thisRevenu - prevRevenu) / prevRevenu) * 100 : undefined;
  const depenseTrend = prevDepense > 0 ? ((thisDepense - prevDepense) / prevDepense) * 100 : undefined;

  /* 6-month chart */
  const chartData: ChartDataPoint[] = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i);
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
      value1: parseFloat(revenus.toFixed(2)),
      value2: parseFloat(depenses.toFixed(2)),
    };
  });

  /* Top categories */
  const catDeps: Record<string, number> = {};
  thisMonthTx.filter(t => t.type === 'depense').forEach(t => {
    catDeps[t.categorie] = (catDeps[t.categorie] || 0) + t.montantConverti;
  });
  const topCats = Object.entries(catDeps).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxCat = topCats[0]?.[1] || 1;

  /* Active budgets */
  const activeBudgets = budgets.filter(b => b.mois === currentMonth + 1 && b.annee === currentYear);

  const fmt = (n: number) => {
    if (hideBalance) return '••••••';
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="p-5 md:p-7 space-y-5 animate-fadeUp">
      {/* ── Balance Hero Card ── */}
      <div
        className="relative rounded-2xl p-6 overflow-hidden balance-gradient border border-primary/20 shadow-2xl"
        style={{ animationDelay: '0ms' }}
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-56 h-56 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-violet-500/10 rounded-full translate-y-1/2 blur-2xl pointer-events-none" />

        <div className="relative">
          {/* Header row */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Solde Total</p>
              <p className="text-sm text-foreground/70">
                Bonjour {settings?.username || 'vous'} 👋
              </p>
            </div>
            <div className="flex gap-1.5 items-center">
              <button
                onClick={() => setHideBalance(h => !h)}
                className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center transition-all border border-white/10"
                data-testid="btn-toggle-balance"
              >
                {hideBalance
                  ? <EyeOff className="h-4 w-4 text-muted-foreground" />
                  : <Eye className="h-4 w-4 text-muted-foreground" />
                }
              </button>
              <InfoModal
                title="Tableau de bord"
                description="Vue d'ensemble de vos finances: solde total, revenus et dépenses du mois, évolution sur 6 mois et vos top catégories de dépenses."
              />
            </div>
          </div>

          {/* Balance amount */}
          <div className="animate-countUp">
            <p
              className="text-5xl font-extrabold tracking-tight text-gradient leading-none"
              data-testid="balance-amount"
            >
              {fmt(balance)}
            </p>
            <p className="text-lg font-semibold text-muted-foreground mt-1">{defaultCurrency}</p>
          </div>

          {/* Mini metrics row */}
          <div className="flex gap-4 mt-5 pt-4 border-t border-white/8">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <ArrowUpRight className="h-3 w-3 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">Revenus</p>
                <p className="text-xs font-semibold text-emerald-400 leading-none mt-0.5">{thisRevenu.toFixed(0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                <ArrowDownRight className="h-3 w-3 text-red-400" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">Dépenses</p>
                <p className="text-xs font-semibold text-red-400 leading-none mt-0.5">{thisDepense.toFixed(0)}</p>
              </div>
            </div>
            <div className="ml-auto">
              <p className="text-[10px] text-muted-foreground leading-none text-right">Ce mois</p>
              <p className="text-xs font-semibold text-foreground leading-none mt-0.5 text-right">
                {format(now, 'MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Revenue & Expense Cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Revenus du mois"
          value={thisRevenu}
          currency={defaultCurrency}
          icon={TrendingUp}
          iconBg="bg-emerald-500/15"
          iconColor="text-emerald-400"
          trend={revenuTrend}
          delay={60}
        />
        <StatCard
          label="Dépenses du mois"
          value={thisDepense}
          currency={defaultCurrency}
          icon={TrendingDown}
          iconBg="bg-red-500/15"
          iconColor="text-red-400"
          trend={depenseTrend}
          delay={120}
        />
      </div>

      {/* ── 6-month chart ── */}
      <div className="glass rounded-2xl p-5 animate-fadeUp" style={{ animationDelay: '180ms' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold">Évolution sur 6 mois</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Revenus vs Dépenses</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />Revenus
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />Dépenses
            </span>
          </div>
        </div>
        {transactions.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            <div className="text-center space-y-2">
              <BarChart2 className="h-8 w-8 mx-auto opacity-20" />
              <p>Ajoutez des transactions pour voir le graphique</p>
            </div>
          </div>
        ) : (
          <MiniAreaChart
            data={chartData}
            currency={defaultCurrency}
            height={170}
            label1="Revenus"
            label2="Dépenses"
            color1="#34d399"
            color2="#f87171"
          />
        )}
      </div>

      {/* ── Top categories ── */}
      {topCats.length > 0 && (
        <div className="glass rounded-2xl p-5 animate-fadeUp" style={{ animationDelay: '240ms' }}>
          <h2 className="text-sm font-semibold mb-4">Top dépenses ce mois</h2>
          <div className="space-y-3.5">
            {topCats.map(([cat, amount], i) => (
              <div key={cat} data-testid={`top-cat-${cat}`} className="animate-fadeIn" style={{ animationDelay: `${240 + i * 60}ms` }}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-sm">{cat}</span>
                  <span className="text-muted-foreground text-xs">{amount.toFixed(2)} {defaultCurrency}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(amount / maxCat) * 100}%`,
                      background: `linear-gradient(90deg, hsl(var(--primary)), hsl(271 91% 72%))`,
                      animationDelay: `${300 + i * 80}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active budgets ── */}
      {activeBudgets.length > 0 && (
        <div className="glass rounded-2xl p-5 animate-fadeUp" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Budgets ce mois</h2>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3.5">
            {activeBudgets.map(b => {
              const actual = transactions
                .filter(t => t.type === 'depense' && t.categorie === b.categorie
                  && new Date(t.date).getMonth() + 1 === b.mois
                  && new Date(t.date).getFullYear() === b.annee)
                .reduce((s, t) => s + t.montantConverti, 0);
              const pct = Math.min((actual / b.plafond) * 100, 100);
              const exceeded = actual > b.plafond;
              const color = pct >= 100 ? '#f87171' : pct >= 80 ? '#fbbf24' : '#34d399';
              return (
                <div key={b.id} data-testid={`budget-card-${b.id}`}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {exceeded && <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                      <span className={`font-medium ${exceeded ? 'text-red-400' : ''}`}>{b.categorie}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{actual.toFixed(0)} / {b.plafond.toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {transactions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm animate-fadeIn" style={{ animationDelay: '400ms' }}>
          <TrendingUp className="h-8 w-8 mx-auto mb-3 opacity-20" />
          <p>Commencez par ajouter votre première transaction !</p>
        </div>
      )}

      {/* Tooltip is next to balance toggle */}
    </div>
  );
}
