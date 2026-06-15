import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Budget } from '../services/db';
import { useAppContext } from '../context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Info, Plus, Trash2, PieChart } from 'lucide-react';
import InfoModal from '../components/InfoModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Budgets() {
  const { settings } = useAppContext();
  const defaultCurrency = settings?.defaultCurrency || 'EUR';
  const now = new Date();
  const [showInfo, setShowInfo] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [categorie, setCategorie] = useState('');
  const [plafond, setPlafond] = useState('');
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());

  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.where('type').equals('depense').filter(c => !c.parentId).toArray()) || [];

  // Compute actual spending per category/month
  const getActual = (categorieName: string, m: number, y: number) => {
    return transactions
      .filter(t => t.type === 'depense' && t.categorie === categorieName && new Date(t.date).getMonth() + 1 === m && new Date(t.date).getFullYear() === y)
      .reduce((s, t) => s + t.montantConverti, 0);
  };

  const handleAdd = async () => {
    if (!categorie || !plafond) return;
    const actual = getActual(categorie, mois, annee);
    await db.budgets.add({ categorie, plafond: parseFloat(plafond), montantActuel: actual, mois, annee });
    setCategorie(''); setPlafond('');
    setShowAdd(false);
  };

  const handleDelete = async () => {
    if (deleteId !== null) { await db.budgets.delete(deleteId); setDeleteId(null); }
  };

  const getBarColor = (pct: number) => {
    if (pct >= 100) return 'bg-red-500';
    if (pct >= 80) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="p-4 md:p-6 animate-fadeUp space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid="btn-add-budget">
            <Plus className="h-4 w-4 mr-1" /> Nouveau
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowInfo(true)} data-testid="btn-info">
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {budgets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <PieChart className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun budget défini.</p>
          <Button size="sm" className="mt-4" onClick={() => setShowAdd(true)}>Créer un budget</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map(b => {
            const actual = getActual(b.categorie, b.mois, b.annee);
            const pct = Math.min((actual / b.plafond) * 100, 100);
            const exceeded = actual > b.plafond;
            return (
              <div key={b.id} className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-card-border" data-testid={`budget-${b.id}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-sm">{b.categorie}</p>
                    <p className="text-xs text-muted-foreground">{String(b.mois).padStart(2, '0')}/{b.annee}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${exceeded ? 'text-red-500' : 'text-foreground'}`}>
                        {actual.toFixed(0)} / {b.plafond.toFixed(0)} {defaultCurrency}
                      </p>
                      {exceeded && <p className="text-xs text-red-500">Dépassé de {(actual - b.plafond).toFixed(0)}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(b.id!)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${getBarColor(pct)}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground text-right">{pct.toFixed(0)}%</div>
              </div>
            );
          })}
        </div>
      )}

      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} title="Budgets" description="Définissez des plafonds par catégorie et suivez vos dépenses. La barre passe en rouge quand le budget est dépassé." />

      <Dialog open={showAdd} onOpenChange={o => !o && setShowAdd(false)}>
        <DialogContent className="animate-zoomIn bg-card/95 backdrop-blur-xl border-card-border sm:max-w-sm">
          <DialogHeader><DialogTitle>Nouveau budget</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Catégorie</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={categorie} onChange={e => setCategorie(e.target.value)}
                data-testid="select-budget-category"
              >
                <option value="">Sélectionner...</option>
                {categories.map(c => <option key={c.id} value={c.nom}>{c.emoji} {c.nom}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Plafond ({defaultCurrency})</Label>
              <Input type="number" value={plafond} onChange={e => setPlafond(e.target.value)} placeholder="500" data-testid="input-budget-amount" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label>Mois</Label>
                <Input type="number" min={1} max={12} value={mois} onChange={e => setMois(Number(e.target.value))} data-testid="input-budget-month" />
              </div>
              <div className="flex-1 space-y-1">
                <Label>Année</Label>
                <Input type="number" min={2020} value={annee} onChange={e => setAnnee(Number(e.target.value))} data-testid="input-budget-year" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1">Annuler</Button>
              <Button onClick={handleAdd} className="flex-1" data-testid="btn-save-budget">Créer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-card-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce budget ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
