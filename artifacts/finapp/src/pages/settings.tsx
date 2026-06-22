import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { useAppContext } from '../context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Info, Moon, Sun, Download, FileText, Trash2, Lock, Unlock, Fingerprint } from 'lucide-react';
import InfoModal from '../components/InfoModal';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CDF', 'XAF', 'MAD', 'TND', 'CAD'];

const COLOR_OPTIONS = [
  { label: 'Indigo', value: '239 84% 67%' },
  { label: 'Violet', value: '271 91% 65%' },
  { label: 'Rose', value: '330 81% 60%' },
  { label: 'Cyan', value: '187 85% 53%' },
  { label: 'Emerald', value: '158 64% 52%' },
  { label: 'Amber', value: '38 92% 50%' },
  { label: 'Orange', value: '25 95% 53%' },
  { label: 'Slate', value: '215 25% 55%' },
];

export default function Settings() {
  const { settings, updateSettings, theme, toggleTheme, primaryColor, setPrimaryColor } = useAppContext();
  const { toast } = useToast();
  const [showPinModal, setShowPinModal] = useState(false);
  const [username, setUsername] = useState(settings?.username || '');
  const [currency, setCurrency] = useState(settings?.defaultCurrency || 'EUR');

  useEffect(() => {
    if (!settings) return;
    setUsername(settings.username || '');
    setCurrency(settings.defaultCurrency || 'EUR');
  }, [settings]);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  const handleSaveProfile = async () => {
    await updateSettings({ username, defaultCurrency: currency });
    toast({ title: 'Profil mis à jour', description: 'Vos préférences ont été sauvegardées.' });
  };

  const handleColorChange = async (color: string) => {
    setPrimaryColor(color);
    await updateSettings({ customColors: color });
    document.documentElement.style.setProperty('--primary', color);
  };

  const handleSavePin = async () => {
    setPinError('');
    if (newPin && newPin.length !== 4) { setPinError('Le PIN doit être exactement 4 chiffres.'); return; }
    if (newPin !== confirmPin) { setPinError('Les codes PIN ne correspondent pas.'); return; }
    await updateSettings({ pinCode: newPin });
    setNewPin(''); setConfirmPin(''); setShowPinModal(false);
    toast({ title: newPin ? 'PIN mis à jour' : 'PIN supprimé' });
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const transactions = await db.transactions.toArray();
    const data = transactions.map(t => ({
      Date: t.date, Type: t.type, Catégorie: t.categorie,
      'Sous-catégorie': t.sousCategorie, Article: t.item,
      Montant: t.montant, Devise: t.devise,
      'Montant converti': t.montantConverti,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `finapp-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'Export Excel réussi' });
  };

  const handleExportWord = async () => {
    const docx = await import('docx');
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
    const transactions = await db.transactions.toArray();
    const revenus = transactions.filter(t => t.type === 'revenu').reduce((s, t) => s + t.montantConverti, 0);
    const depenses = transactions.filter(t => t.type === 'depense').reduce((s, t) => s + t.montantConverti, 0);
    const solde = revenus - depenses;

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: 'Rapport Financier FinApp', heading: HeadingLevel.TITLE }),
          new Paragraph({ text: format(new Date(), 'dd MMMM yyyy', { locale: fr }), style: 'Normal' }),
          new Paragraph({ text: '' }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Résumé')] }),
          new Paragraph({ children: [new TextRun(`Solde total: ${solde.toFixed(2)} ${settings?.defaultCurrency || 'EUR'}`)] }),
          new Paragraph({ children: [new TextRun(`Total revenus: ${revenus.toFixed(2)}`)] }),
          new Paragraph({ children: [new TextRun(`Total dépenses: ${depenses.toFixed(2)}`)] }),
          new Paragraph({ text: '' }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Transactions récentes')] }),
          ...transactions.slice(0, 20).map(t => new Paragraph({
            children: [new TextRun(`${t.date} | ${t.type} | ${t.categorie} | ${t.montantConverti.toFixed(2)}`)]
          })),
        ]
      }]
    });

    const buffer = await Packer.toBlob(doc);
    const url = URL.createObjectURL(buffer);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finapp-rapport-${format(new Date(), 'yyyy-MM-dd')}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export Word réussi' });
  };

  return (
    <div className="p-4 md:p-6 animate-fadeUp space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <InfoModal title="Paramètres" description="Personnalisez votre profil, thème, couleur principale et gérez la sécurité de l'application. Exportez vos données en Excel ou Word." />
      </header>

      {/* Profile */}
      <section className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-card-border space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Profil</h2>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Prénom</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} data-testid="input-username" />
          </div>
          <div className="space-y-1">
            <Label>Devise par défaut</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={currency} onChange={e => setCurrency(e.target.value)}
              data-testid="select-currency"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Button onClick={handleSaveProfile} className="w-full" data-testid="btn-save-profile">Enregistrer</Button>
        </div>
      </section>

      {/* Theme */}
      <section className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-card-border space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Apparence</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span className="text-sm">{theme === 'dark' ? 'Mode sombre' : 'Mode clair'}</span>
          </div>
          <Button variant="outline" size="sm" onClick={toggleTheme} data-testid="btn-toggle-theme">
            Changer
          </Button>
        </div>

        <div>
          <Label className="text-sm mb-3 block">Couleur principale</Label>
          <div className="grid grid-cols-4 gap-2">
            {COLOR_OPTIONS.map(c => (
              <button
                key={c.value}
                onClick={() => handleColorChange(c.value)}
                className={`h-10 rounded-lg transition-all active:scale-95 ${primaryColor === c.value ? 'ring-2 ring-offset-2 ring-offset-background scale-105' : ''}`}
                style={{ backgroundColor: `hsl(${c.value})` }}
                title={c.label}
                data-testid={`color-${c.label}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-card-border space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Sécurité</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {settings?.pinCode ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm">{settings?.pinCode ? 'PIN activé' : 'PIN désactivé'}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowPinModal(true)} data-testid="btn-manage-pin">
            Modifier
          </Button>
        </div>
        {settings?.pinCode && (
          <div className="flex items-center justify-between pt-3 border-t border-card-border/40 animate-fadeIn">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Déverrouillage biométrique</span>
            </div>
            <button
              onClick={async () => {
                await updateSettings({ biometricsEnabled: !settings.biometricsEnabled });
                toast({
                  title: !settings.biometricsEnabled ? "Biométrie activée" : "Biométrie désactivée",
                  description: !settings.biometricsEnabled 
                    ? "Vous pouvez maintenant utiliser l'empreinte/visage pour déverrouiller." 
                    : "Déverrouillage biométrique désactivé."
                });
              }}
              className={`w-11 h-6 rounded-full transition-colors relative ${settings.biometricsEnabled ? 'bg-primary' : 'bg-muted'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform duration-200 ${settings.biometricsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        )}
      </section>

      {/* Exports */}
      <section className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-card-border space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Exports</h2>
        <Button variant="outline" onClick={handleExportExcel} className="w-full justify-start" data-testid="btn-export-excel">
          <Download className="h-4 w-4 mr-2" /> Exporter en Excel (.xlsx)
        </Button>
        <Button variant="outline" onClick={handleExportWord} className="w-full justify-start" data-testid="btn-export-word">
          <FileText className="h-4 w-4 mr-2" /> Exporter rapport Word (.docx)
        </Button>
      </section>

      {/* User Guide */}
      <section className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-card-border space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Guide d'utilisation</h2>
        <div className="space-y-3.5 text-sm text-foreground/90">
          <div className="p-3 bg-muted/30 rounded-xl space-y-1">
            <h3 className="font-semibold text-primary">📝 Enregistrer vos opérations</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dans l'onglet <strong>Transactions</strong>, cliquez sur le bouton <strong>+</strong> pour ajouter une opération. Suivez les étapes simples : choisissez le type, sélectionnez la catégorie, précisez l'article, saisissez le montant et validez.
            </p>
          </div>

          <div className="p-3 bg-muted/30 rounded-xl space-y-1">
            <h3 className="font-semibold text-primary">🎯 Suivre un budget</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Fixez-vous des limites dans l'onglet <strong>Budgets</strong>. Choisissez une catégorie et un montant maximum pour le mois. Si vous respectez tous vos budgets à la fin du mois, l'application vous célébrera avec des confettis !
            </p>
          </div>

          <div className="p-3 bg-muted/30 rounded-xl space-y-1">
            <h3 className="font-semibold text-primary">📲 Synchroniser plusieurs appareils</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pour partager vos comptes avec un conjoint ou un autre téléphone, allez dans l'onglet <strong>Synchronisation</strong>. Créez un groupe, puis recopiez le code sur le deuxième appareil pour lier vos comptes de manière permanente.
            </p>
          </div>

          <div className="p-3 bg-muted/30 rounded-xl space-y-1">
            <h3 className="font-semibold text-primary">💬 Discuter avec Sofia, votre assistante</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dans l'onglet <strong>Assistant IA</strong>, vous pouvez poser des questions en français simple (par exemple : "Combien ai-je dépensé ce mois-ci ?"). Sofia vous répondra comme une amie bienveillante, avec des conseils pratiques.
            </p>
          </div>
        </div>
      </section>

      {/* App info */}
      <section className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-card-border">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">À propos</h2>
        <p className="text-sm text-muted-foreground">FinApp v1.0 — Local-First Finance</p>
        <p className="text-xs text-muted-foreground mt-1">Toutes vos données sont stockées localement sur votre appareil.</p>
      </section>

      {/* Tooltip in header */}

      <Dialog open={showPinModal} onOpenChange={o => !o && setShowPinModal(false)}>
        <DialogContent className="animate-zoomIn bg-card/95 backdrop-blur-xl border-card-border sm:max-w-xs">
          <DialogHeader><DialogTitle>Gérer le code PIN</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Nouveau PIN (laisser vide pour désactiver)</Label>
              <Input type="password" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="4 chiffres" data-testid="input-new-pin" />
            </div>
            <div className="space-y-1">
              <Label>Confirmer le PIN</Label>
              <Input type="password" maxLength={4} value={confirmPin} onChange={e => setConfirmPin(e.target.value)} placeholder="4 chiffres" data-testid="input-confirm-pin" />
            </div>
            {pinError && <p className="text-destructive text-sm">{pinError}</p>}
            {settings?.pinCode && (
              <Button variant="outline" className="w-full text-destructive" onClick={() => { setNewPin(''); setConfirmPin(''); handleSavePin(); }}>
                <Trash2 className="h-4 w-4 mr-2" /> Supprimer le PIN
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPinModal(false)} className="flex-1">Annuler</Button>
              <Button onClick={handleSavePin} className="flex-1" data-testid="btn-save-pin">Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
