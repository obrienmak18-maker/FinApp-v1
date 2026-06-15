import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useAppContext } from '../context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Info, Plus, Trash2, Target, CheckCircle2 } from 'lucide-react';
import InfoModal from '../components/InfoModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Projects() {
  const { settings } = useAppContext();
  const defaultCurrency = settings?.defaultCurrency || 'EUR';
  const [showInfo, setShowInfo] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showContrib, setShowContrib] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [montantCible, setMontantCible] = useState('');
  const [contribution, setContribution] = useState('');

  const projects = useLiveQuery(() => db.projects.toArray()) || [];

  const handleAdd = async () => {
    if (!titre || !montantCible) return;
    await db.projects.add({ titre, description, montantCible: parseFloat(montantCible), montantActuel: 0, type: 'épargne', statut: 'actif' });
    setTitre(''); setDescription(''); setMontantCible('');
    setShowAdd(false);
  };

  const handleContrib = async () => {
    if (!contribution || showContrib === null) return;
    const project = await db.projects.get(showContrib);
    if (!project) return;
    const newAmount = project.montantActuel + parseFloat(contribution);
    const statut = newAmount >= project.montantCible ? 'terminé' : 'actif';
    await db.projects.update(showContrib, { montantActuel: newAmount, statut });
    setContribution(''); setShowContrib(null);
  };

  const handleDelete = async () => {
    if (deleteId !== null) { await db.projects.delete(deleteId); setDeleteId(null); }
  };

  return (
    <div className="p-4 md:p-6 animate-fadeUp space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Projets d'épargne</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid="btn-add-project">
            <Plus className="h-4 w-4 mr-1" /> Nouveau
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowInfo(true)} data-testid="btn-info">
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun projet d'épargne.</p>
          <Button size="sm" className="mt-4" onClick={() => setShowAdd(true)}>Créer un projet</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(p => {
            const pct = Math.min((p.montantActuel / p.montantCible) * 100, 100);
            const done = p.statut === 'terminé';
            return (
              <div key={p.id} className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-card-border" data-testid={`project-${p.id}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{p.titre}</p>
                      {done && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>}
                  </div>
                  <div className="flex gap-1 ml-3 shrink-0">
                    {!done && (
                      <Button size="sm" variant="outline" onClick={() => setShowContrib(p.id!)} className="h-7 text-xs" data-testid={`btn-contrib-${p.id}`}>
                        + Verser
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id!)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{p.montantActuel.toFixed(0)} {defaultCurrency}</span>
                  <span>{pct.toFixed(0)}% · Objectif: {p.montantCible.toFixed(0)} {defaultCurrency}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} title="Projets d'épargne" description="Créez des cagnottes avec un objectif et suivez votre progression. Ajoutez des versements pour avancer vers votre but." />

      <Dialog open={showAdd} onOpenChange={o => !o && setShowAdd(false)}>
        <DialogContent className="animate-zoomIn bg-card/95 backdrop-blur-xl border-card-border sm:max-w-sm">
          <DialogHeader><DialogTitle>Nouveau projet d'épargne</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Titre</Label>
              <Input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Vacances, Voiture, Urgences..." data-testid="input-project-title" />
            </div>
            <div className="space-y-1">
              <Label>Description (optionnel)</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Décrivez votre objectif..." rows={2} data-testid="input-project-desc" />
            </div>
            <div className="space-y-1">
              <Label>Montant cible ({defaultCurrency})</Label>
              <Input type="number" value={montantCible} onChange={e => setMontantCible(e.target.value)} placeholder="1000" data-testid="input-project-target" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1">Annuler</Button>
              <Button onClick={handleAdd} className="flex-1" data-testid="btn-save-project">Créer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showContrib !== null} onOpenChange={o => !o && setShowContrib(null)}>
        <DialogContent className="animate-zoomIn bg-card/95 backdrop-blur-xl border-card-border sm:max-w-xs">
          <DialogHeader><DialogTitle>Ajouter un versement</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Montant ({defaultCurrency})</Label>
              <Input type="number" value={contribution} onChange={e => setContribution(e.target.value)} placeholder="100" data-testid="input-contribution" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowContrib(null)} className="flex-1">Annuler</Button>
              <Button onClick={handleContrib} className="flex-1" data-testid="btn-save-contribution">Verser</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-card-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce projet ?</AlertDialogTitle>
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
