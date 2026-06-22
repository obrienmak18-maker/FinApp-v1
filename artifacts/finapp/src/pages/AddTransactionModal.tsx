import React, { useState, useEffect } from 'react';
import { db, Category } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppContext } from '../context/AppContext';
import { getExchangeRate } from '../services/exchangeRate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle, ScanLine } from 'lucide-react';
import AddCategoryModal from '../components/AddCategoryModal';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CDF', 'XAF', 'MAD', 'TND', 'CAD', 'JPY', 'CNY'];

interface AddTransactionModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AddTransactionModal({ open, onClose }: AddTransactionModalProps) {
  const { settings } = useAppContext();
  const defaultCurrency = settings?.defaultCurrency || 'EUR';

  const [step, setStep] = useState(1);
  const [type, setType] = useState<'revenu' | 'depense'>('depense');
  const [categorie, setCategorie] = useState('');
  const [categorieId, setCategorieId] = useState<number | undefined>();
  const [sousCategorie, setSousCategorie] = useState('');
  const [item, setItem] = useState('');
  const [montant, setMontant] = useState('');
  const [devise, setDevise] = useState(defaultCurrency);
  const [montantConverti, setMontantConverti] = useState<number | null>(null);
  const [tauxDuJour, setTauxDuJour] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  // showAddCat drives AddCategoryModal — when true, parent dialog is hidden to avoid Radix focus-trap clash
  const [showAddCat, setShowAddCat] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const balance = allTransactions.reduce((acc, t) =>
    t.type === 'revenu' ? acc + t.montantConverti : acc - t.montantConverti, 0);

  const parentCategories = useLiveQuery(
    () => db.categories.where('type').equals(type).filter(c => !c.parentId).toArray(),
    [type]
  ) || [];

  const subCategories = useLiveQuery<import('../services/db').Category[]>(
    () => categorieId ? db.categories.where('parentId').equals(categorieId).toArray() : Promise.resolve([] as import('../services/db').Category[]),
    [categorieId]
  ) || [];

  useEffect(() => {
    if (montant && devise && defaultCurrency) {
      const amount = parseFloat(montant);
      if (isNaN(amount)) return;
      setConverting(true);
      getExchangeRate(devise, defaultCurrency).then(rate => {
        setTauxDuJour(rate);
        setMontantConverti(amount * rate);
        setConverting(false);
      });
    }
  }, [montant, devise, defaultCurrency]);

  const handleNext = () => {
    setError('');
    if (step === 2 && !categorie) { setError('Sélectionnez une catégorie.'); return; }
    if (step === 5) {
      const amount = parseFloat(montant);
      if (isNaN(amount) || amount <= 0) { setError('Montant invalide.'); return; }
      if (type === 'depense' && montantConverti !== null && montantConverti > balance) {
        setError(`Solde insuffisant. Solde disponible: ${balance.toFixed(2)} ${defaultCurrency}`);
        return;
      }
    }
    if (step === 3 && subCategories.length === 0) { setStep(5); return; }
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setError('');
    if (step === 5 && subCategories.length === 0) { setStep(3); return; }
    setStep(s => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    const amount = parseFloat(montant);
    if (isNaN(amount) || amount <= 0) return;
    if (type === 'depense' && montantConverti !== null && montantConverti > balance) {
      setError(`Solde insuffisant. Solde disponible: ${balance.toFixed(2)} ${defaultCurrency}`);
      return;
    }
    await db.transactions.add({
      type, montant: amount, devise, montantConverti: montantConverti ?? amount,
      date, categorie, sousCategorie, item, tauxDuJour
    });
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setStep(1); setType('depense'); setCategorie(''); setCategorieId(undefined);
    setSousCategorie(''); setItem(''); setMontant(''); setDevise(defaultCurrency);
    setMontantConverti(null); setDate(new Date().toISOString().split('T')[0]);
    setError(''); setScanDone(false);
  };

  const simulateScan = () => {
    setScanLoading(true);
    setTimeout(() => {
      setMontant('47.50');
      setDevise(defaultCurrency);
      setItem('Courses supermarché');
      setScanLoading(false);
      setScanDone(true);
    }, 2500);
  };

  const steps = ['Type', 'Catégorie', 'Sous-cat.', 'Article', 'Montant', 'Date', 'Facture'];
  const currentStep = step;

  return (
    <>
      {/* Parent dialog — hidden while AddCategoryModal is open to prevent Radix focus-trap conflict */}
      <Dialog open={open && !showAddCat} onOpenChange={o => { if (!o) { handleReset(); onClose(); } }}>
        <DialogContent className="animate-zoomIn sm:max-w-lg bg-card/95 backdrop-blur-xl border-card-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle transaction</DialogTitle>
          </DialogHeader>

          {/* Progress */}
          <div className="flex gap-1 mt-1">
            {steps.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i + 1 <= currentStep ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{steps[currentStep - 1]}</p>

          <div className="space-y-4 min-h-[200px]">
            {/* Step 1 — Type */}
            {step === 1 && (
              <div className="grid grid-cols-2 gap-4 py-4" data-testid="step-type">
                <button
                  onClick={() => { setType('revenu'); setStep(2); }}
                  className="p-6 rounded-xl border-2 border-emerald-500 bg-emerald-500/10 text-emerald-500 font-semibold text-lg active:scale-95 transition-all hover:bg-emerald-500/20"
                  data-testid="btn-type-revenu"
                >Revenu</button>
                <button
                  onClick={() => { setType('depense'); setStep(2); }}
                  className="p-6 rounded-xl border-2 border-red-500 bg-red-500/10 text-red-500 font-semibold text-lg active:scale-95 transition-all hover:bg-red-500/20"
                  data-testid="btn-type-depense"
                >Dépense</button>
              </div>
            )}

            {/* Step 2 — Category */}
            {step === 2 && (
              <div className="space-y-2" data-testid="step-category">
                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {parentCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { setCategorie(cat.nom); setCategorieId(cat.id); setSousCategorie(''); }}
                      className={`p-3 rounded-lg border text-left text-sm transition-all ${categorie === cat.nom ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'}`}
                      data-testid={`cat-${cat.id}`}
                    >
                      <span className="mr-1">{cat.emoji}</span>{cat.nom}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowAddCat(true)}
                  className="w-full py-2 rounded-lg border border-dashed border-primary/50 text-primary text-sm hover:bg-primary/5 transition-all"
                  data-testid="btn-add-category-inline"
                >+ Nouvelle catégorie</button>
                {error && <p className="text-destructive text-sm">{error}</p>}
              </div>
            )}

            {/* Step 3 — Sub-category */}
            {step === 3 && (
              <div className="space-y-2" data-testid="step-subcategory">
                {subCategories.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">Aucune sous-catégorie disponible. Cliquez sur Suivant.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {subCategories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSousCategorie(cat.nom)}
                        className={`p-3 rounded-lg border text-left text-sm transition-all ${sousCategorie === cat.nom ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'}`}
                      >
                        <span className="mr-1">{cat.emoji}</span>{cat.nom}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 4 — Item */}
            {step === 4 && (
              <div className="space-y-2 py-4" data-testid="step-item">
                <Label>Précisez l'article (optionnel)</Label>
                <Input
                  value={item}
                  onChange={e => setItem(e.target.value)}
                  placeholder="Ex: Tomates cerise, Netflix, Loyer Janvier..."
                  data-testid="input-item"
                />
              </div>
            )}

            {/* Step 5 — Amount & Currency */}
            {step === 5 && (
              <div className="space-y-4 py-2" data-testid="step-amount">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label>Montant</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={montant}
                      onChange={e => setMontant(e.target.value)}
                      placeholder="0.00"
                      data-testid="input-amount"
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label>Devise</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={devise}
                      onChange={e => setDevise(e.target.value)}
                      data-testid="select-currency"
                    >
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                {converting && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Conversion en cours...
                  </div>
                )}
                {montantConverti !== null && !converting && devise !== defaultCurrency && (
                  <p className="text-sm text-muted-foreground">
                    ≈ <span className="font-semibold text-foreground">{montantConverti.toFixed(2)} {defaultCurrency}</span> (taux: {tauxDuJour.toFixed(4)})
                  </p>
                )}
                {type === 'depense' && montantConverti !== null && montantConverti > balance && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Solde insuffisant. Disponible: {balance.toFixed(2)} {defaultCurrency}
                  </div>
                )}
                {error && <p className="text-destructive text-sm">{error}</p>}
              </div>
            )}

            {/* Step 6 — Date */}
            {step === 6 && (
              <div className="space-y-2 py-4" data-testid="step-date">
                <Label>Date de la transaction</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  data-testid="input-date"
                />
              </div>
            )}

            {/* Step 7 — Invoice Scanner (Beta) */}
            {step === 7 && (
              <div className="space-y-4 py-2" data-testid="step-scanner">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-sm font-medium flex items-center gap-2">
                  <span>Fonctionnalité en développement (Beta)</span>
                </div>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center space-y-4">
                  <ScanLine className="h-10 w-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">Photographiez ou importez votre facture pour extraction automatique</p>
                  {!scanDone ? (
                    <Button
                      variant="outline"
                      onClick={simulateScan}
                      disabled={scanLoading}
                      data-testid="btn-scan"
                    >
                      {scanLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Analyse en cours...</>
                      ) : 'Importer une facture'}
                    </Button>
                  ) : (
                    <div className="text-emerald-500 text-sm font-medium">Données extraites et pré-remplies !</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          {step > 1 && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleBack} className="flex-1" data-testid="btn-back">
                <ChevronLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              {step < 7 ? (
                <Button onClick={handleNext} className="flex-1" data-testid="btn-next">
                  Suivant <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="btn-submit">
                  Enregistrer
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AddCategoryModal is rendered OUTSIDE the parent Dialog to avoid Radix focus-trap conflicts.
          When showAddCat is true, the parent dialog is temporarily hidden (open={open && !showAddCat})
          so both dialogs never coexist, eliminating the input-blocking bug. */}
      <AddCategoryModal
        open={showAddCat}
        onClose={() => setShowAddCat(false)}
        defaultType={type}
        onCreated={(cat) => {
          if (cat.parentId) {
            db.categories.get(cat.parentId).then(parent => {
              if (parent) {
                setCategorie(parent.nom);
                setCategorieId(parent.id);
                setSousCategorie(cat.nom);
                setStep(3);
              }
            });
          } else {
            setCategorie(cat.nom);
            setCategorieId(cat.id);
            setSousCategorie('');
            setStep(2);
          }
        }}
      />
    </>
  );
}
