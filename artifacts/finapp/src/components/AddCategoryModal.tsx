import React, { useState } from 'react';
import { db, Category } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X } from 'lucide-react';

const EMOJIS = [
  '💰','💸','💳','🏦','📊','📈','📉','💹','🎯','🏆',
  '🍕','🍔','🛒','🚗','🏠','🎮','💊','📱','👕','📚',
  '✈️','🎬','🎵','⚽','🏋️','🌿','🐶','🎁','🛠️','🔑',
  '🏖️','🎨','📷','🌍','🤝','📦','🍷','☕','🎂','💼',
];

interface AddCategoryModalProps {
  open: boolean;
  onClose: () => void;
  defaultType?: 'revenu' | 'depense';
}

export default function AddCategoryModal({ open, onClose, defaultType = 'depense' }: AddCategoryModalProps) {
  const [type, setType] = useState<'revenu' | 'depense'>(defaultType);
  const [nom, setNom] = useState('');
  const [emoji, setEmoji] = useState('');
  const [parentId, setParentId] = useState<number | undefined>(undefined);
  const [error, setError] = useState('');

  const parentCategories = useLiveQuery(
    () => db.categories.where('type').equals(type).filter(c => !c.parentId).toArray(),
    [type]
  ) || [];

  const handleSave = async () => {
    if (!nom.trim()) { setError('Veuillez entrer un nom.'); return; }
    const exists = await db.categories.where('nom').equalsIgnoreCase(nom.trim()).count();
    if (exists > 0) { setError('Cette catégorie existe déjà.'); return; }
    
    await db.categories.add({ type, nom: nom.trim(), emoji, parentId });
    setNom(''); setEmoji(''); setParentId(undefined); setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="animate-zoomIn sm:max-w-md bg-card/95 backdrop-blur-xl border-card-border">
        <DialogHeader>
          <DialogTitle>Nouvelle catégorie</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex gap-2">
            <button
              onClick={() => setType('depense')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${type === 'depense' ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-border text-muted-foreground'}`}
              data-testid="type-depense"
            >Dépense</button>
            <button
              onClick={() => setType('revenu')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${type === 'revenu' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-border text-muted-foreground'}`}
              data-testid="type-revenu"
            >Revenu</button>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Emoji (optionnel)</Label>
            <div className="grid grid-cols-8 gap-1">
              <button
                onClick={() => setEmoji('')}
                className={`h-8 w-8 rounded text-xs ${emoji === '' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >—</button>
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`h-8 w-8 rounded text-base transition-all ${emoji === e ? 'bg-primary/20 ring-1 ring-primary scale-110' : 'hover:bg-muted'}`}
                >{e}</button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Nom de la catégorie</Label>
            <Input
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Ex: Courses, Netflix, Loyer..."
              data-testid="input-category-name"
            />
          </div>

          {parentCategories.length > 0 && (
            <div className="space-y-1">
              <Label>Sous-catégorie de (optionnel)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={parentId ?? ''}
                onChange={e => setParentId(e.target.value ? Number(e.target.value) : undefined)}
                data-testid="select-parent-category"
              >
                <option value="">Aucun (catégorie principale)</option>
                {parentCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.emoji} {cat.nom}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button onClick={handleSave} className="flex-1" data-testid="btn-save-category">Créer</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
