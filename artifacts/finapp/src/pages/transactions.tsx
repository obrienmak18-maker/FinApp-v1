import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useAppContext } from '../context/AppContext';
import { Button } from '@/components/ui/button';
import { Info, Trash2, Download, Filter } from 'lucide-react';
import { format, startOfWeek, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import InfoModal from '../components/InfoModal';
import AddTransactionModal from './AddTransactionModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type FilterType = 'tous' | 'revenu' | 'depense';
type PeriodFilter = 'tout' | 'mois' | 'semaine';

export default function Transactions() {
  const { settings } = useAppContext();
  const defaultCurrency = settings?.defaultCurrency || 'EUR';
  const [filterType, setFilterType] = useState<FilterType>('tous');
  const [period, setPeriod] = useState<PeriodFilter>('tout');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const allTransactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray()) || [];

  const filtered = allTransactions.filter(t => {
    if (filterType !== 'tous' && t.type !== filterType) return false;
    if (period === 'mois') {
      const s = startOfMonth(new Date());
      return new Date(t.date) >= s;
    }
    if (period === 'semaine') {
      const s = startOfWeek(new Date(), { weekStartsOn: 1 });
      return new Date(t.date) >= s;
    }
    return true;
  });

  const handleDelete = async () => {
    if (deleteId !== null) { await db.transactions.delete(deleteId); setDeleteId(null); }
  };

  const handleExport = () => {
    const data = filtered.map(t => ({
      Date: t.date, Type: t.type, Catégorie: t.categorie,
      'Sous-catégorie': t.sousCategorie, Article: t.item,
      Montant: t.montant, Devise: t.devise,
      'Montant converti': t.montantConverti, 'Devise par défaut': defaultCurrency,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `finapp-transactions-${format(new Date(), 'yyyy-MM')}.xlsx`);
  };

  return (
    <div className="p-4 md:p-6 animate-fadeUp space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="btn-export">
            <Download className="h-4 w-4 mr-1" /> Exporter
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowInfo(true)} data-testid="btn-info">
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(['tous', 'revenu', 'depense'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all capitalize ${filterType === f ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              data-testid={`filter-${f}`}
            >
              {f === 'tous' ? 'Tous' : f === 'revenu' ? 'Revenus' : 'Dépenses'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {([['tout', 'Tout'], ['mois', 'Ce mois'], ['semaine', 'Cette sem.']] as [PeriodFilter, string][]).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setPeriod(f)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${period === f ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              data-testid={`period-${f}`}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Filter className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune transaction trouvée.</p>
          </div>
        ) : (
          filtered.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-3 p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-card-border hover:bg-card/70 transition-all"
              data-testid={`transaction-${t.id}`}
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg shrink-0">
                {t.categorie.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {t.sousCategorie || t.categorie}{t.item ? ` — ${t.item}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(t.date), 'd MMM yyyy', { locale: fr })} · {t.categorie}
                </p>
              </div>
              <div className={`font-semibold text-sm shrink-0 ${t.type === 'revenu' ? 'text-emerald-500' : 'text-red-500'}`}>
                {t.montantConverti.toFixed(2)} {defaultCurrency}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteId(t.id!)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                data-testid={`btn-delete-${t.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* FAB area padding */}
      <div className="h-20" />

      <InfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="Transactions"
        description="Consultez toutes vos transactions, filtrez par type ou période, et exportez en Excel. Utilisez le bouton + pour ajouter une nouvelle transaction."
      />

      <AddTransactionModal open={showAdd} onClose={() => setShowAdd(false)} />

      <AlertDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-card-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la transaction ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
