import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  generateGroupId, getDeviceId, pushGroup, pullGroup,
  subscribeToGroup, mergeRemotePayload, removeConflictedTransactions,
  autoPushIfOnline, ConflictItem, MergeResult,
} from '../services/sync';
import { SUPABASE_AVAILABLE } from '../services/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Info, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle,
  Copy, Check, Smartphone, Monitor, Link2, Link2Off, Loader2,
  QrCode, KeyRound, Trash2,
} from 'lucide-react';
import InfoModal from '../components/InfoModal';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import QrScanner from '../components/QrScanner';

// Lazy-load heavy QR libs only when needed
const LazyQRCode = React.lazy(() =>
  import('qrcode.react').then(m => ({ default: m.QRCodeSVG }))
);

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'conflict';
type View = 'main' | 'join' | 'qr';

export default function Sync() {
  const settings = useLiveQuery(() => db.settings.get('user'));
  const groupId = settings?.syncGroupId;
  const { toast } = useToast();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [view, setView] = useState<View>('main');
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const navigate = useNavigate();
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [keepConflicts, setKeepConflicts] = useState<boolean | null>(null);

  // Active real-time subscription ref
  const unsubRef = useRef<(() => void) | null>(null);

  // ── Online/offline detection ──────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => { setIsOnline(true); setStatusMsg(''); };
    const onOffline = () => { setIsOnline(false); setStatusMsg('Hors ligne — sync suspendue'); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── Auto-push when coming back online ────────────────────────────────────
  useEffect(() => {
    if (isOnline && groupId) {
      handleSync(true);
    }
  }, [isOnline, groupId]); // eslint-disable-line

  // ── Real-time subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!groupId || !isOnline) return;

    // Cleanup old subscription
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }

    const initSub = async () => {
      const unsub = await subscribeToGroup(groupId, async (remotePayload) => {
        setStatus('syncing');
        setStatusMsg('Données reçues en temps réel...');
        try {
          const result = await mergeRemotePayload(remotePayload);
          setLastSync(new Date());
          if (result.conflicts.length > 0) {
            setConflicts(result.conflicts);
            setMergeResult(result);
            setStatus('conflict');
            setStatusMsg(`⚠️ Conflit — solde négatif détecté (${result.conflicts.length} transaction(s))`);
          } else {
            setStatus('synced');
            const msg = result.addedCount > 0
              ? `${result.addedCount} nouvelle(s) transaction(s) reçue(s) ✓`
              : 'Données à jour ✓';
            setStatusMsg(msg);
            if (result.addedCount > 0) {
              toast({ title: '⚡ Sync temps réel', description: `${result.addedCount} transaction(s) synchronisée(s)` });
            }
          }
        } catch (e) {
          setStatus('error');
          setStatusMsg('Erreur lors de la synchronisation: ' + String(e));
        }
      });
      unsubRef.current = unsub;
    };
    initSub();

    return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } };
  }, [groupId, isOnline]); // eslint-disable-line

  // ── Sync (push + pull) ────────────────────────────────────────────────────
  const handleSync = useCallback(async (silent = false) => {
    if (!groupId || !isOnline) return;
    setStatus('syncing');
    if (!silent) setStatusMsg('Synchronisation en cours...');
    try {
      // Push local data
      await pushGroup(groupId);
      // Pull remote and merge
      const remote = await pullGroup(groupId);
      if (remote) {
        const result = await mergeRemotePayload(remote);
        setLastSync(new Date());
        if (result.conflicts.length > 0) {
          setConflicts(result.conflicts);
          setMergeResult(result);
          setStatus('conflict');
          setStatusMsg(`⚠️ Conflit détecté — solde négatif`);
        } else {
          setStatus('synced');
          const msg = result.addedCount > 0
            ? `${result.addedCount} transaction(s) synchronisée(s) ✓`
            : 'Déjà à jour ✓';
          setStatusMsg(msg);
        }
      } else {
        setStatus('synced');
        setStatusMsg('Données envoyées ✓');
        setLastSync(new Date());
      }
    } catch (e) {
      setStatus('error');
      setStatusMsg('Erreur: ' + String(e));
      if (!silent) toast({ title: 'Erreur de sync', description: String(e), variant: 'destructive' });
    }
  }, [groupId, isOnline, toast]);

  // ── Create a new group ────────────────────────────────────────────────────
  const handleCreateGroup = async () => {
    const newGroupId = generateGroupId();
    await db.settings.update('user', { syncGroupId: newGroupId });
    setStatus('idle');
    setStatusMsg('Groupe créé ! Partagez le code avec vos autres appareils.');
    toast({ title: '✅ Groupe créé', description: newGroupId });
  };

  // ── Join existing group ───────────────────────────────────────────────────
  const handleJoinGroup = async (codeOverride?: string) => {
    const code = (codeOverride || inputCode).trim().toUpperCase();
    if (!code) return;
    setStatus('syncing');
    setStatusMsg('Connexion au groupe...');
    try {
      const remote = await pullGroup(code);
      if (!remote) {
        setStatus('error');
        setStatusMsg('Groupe introuvable. Vérifiez le code.');
        return;
      }
      await db.settings.update('user', { syncGroupId: code });
      const result = await mergeRemotePayload(remote);
      setLastSync(new Date());
      setView('main');
      setInputCode('');
      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
        setMergeResult(result);
        setStatus('conflict');
        setStatusMsg('⚠️ Conflit détecté après jonction');
      } else {
        setStatus('synced');
        setStatusMsg(`Groupe rejoint ! ${result.addedCount} transaction(s) importée(s) ✓`);
        toast({ title: '✅ Groupe rejoint', description: `${result.addedCount} transaction(s) importée(s)` });
        setTimeout(() => navigate('/dashboard'), 1500);
      }
    } catch (e) {
      setStatus('error');
      setStatusMsg('Erreur: ' + String(e));
    }
  };

  // ── Leave group ────────────────────────────────────────────────────────────
  const handleLeaveGroup = async () => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    await db.settings.update('user', { syncGroupId: '' });
    setStatus('idle');
    setStatusMsg('');
    setConflicts([]);
  };

  // ── Resolve conflicts ─────────────────────────────────────────────────────
  const handleResolveKeep = async () => {
    // Keep all — accept the negative balance (user decides)
    setConflicts([]);
    setStatus('synced');
    setStatusMsg('Transactions conservées. Vérifiez votre solde.');
    setKeepConflicts(null);
  };

  const handleResolveRemove = async () => {
    // Remove conflicting remote transactions to restore positive balance
    const uuids = conflicts.map(c => c.uuid);
    await removeConflictedTransactions(uuids);
    setConflicts([]);
    setStatus('synced');
    setStatusMsg('Transactions conflictuelles supprimées. Solde restauré.');
    setKeepConflicts(null);
    toast({ title: '✅ Conflit résolu', description: 'Les transactions problématiques ont été supprimées.' });
  };

  // ── Copy helpers ──────────────────────────────────────────────────────────
  const copyCode = async () => {
    if (!groupId) return;
    await navigator.clipboard.writeText(groupId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // ── Status indicator ──────────────────────────────────────────────────────
  const statusColor = {
    idle: 'text-muted-foreground',
    syncing: 'text-primary',
    synced: 'text-emerald-400',
    error: 'text-red-400',
    conflict: 'text-amber-400',
  }[status];

  const statusIcon = {
    idle: null,
    syncing: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    synced: <CheckCircle2 className="h-3.5 w-3.5" />,
    error: <AlertTriangle className="h-3.5 w-3.5" />,
    conflict: <AlertTriangle className="h-3.5 w-3.5" />,
  }[status];

  const backendLabel = SUPABASE_AVAILABLE ? 'Supabase Realtime' : 'Firebase';
  const backendColor = SUPABASE_AVAILABLE ? 'text-emerald-400' : 'text-orange-400';

  const formatLastSync = (d: Date) => {
    const diff = Math.round((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `il y a ${diff}s`;
    if (diff < 3600) return `il y a ${Math.round(diff / 60)}min`;
    return `il y a ${Math.round(diff / 3600)}h`;
  };

  return (
    <div className="p-4 md:p-6 animate-fadeUp space-y-5 max-w-xl mx-auto">
      {/* ── Header ── */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Synchronisation</h1>
          <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${backendColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${SUPABASE_AVAILABLE ? 'bg-emerald-400' : 'bg-orange-400'} ${isOnline ? 'animate-pulse' : 'opacity-40'}`} />
            {backendLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOnline
            ? <Wifi className="h-4 w-4 text-emerald-400" />
            : <WifiOff className="h-4 w-4 text-muted-foreground" />}
          <Button variant="ghost" size="icon" onClick={() => setShowInfo(true)}>
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── Online/offline banner ── */}
      {!isOnline && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          <WifiOff className="h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Vous êtes hors ligne</p>
            <p className="text-xs opacity-80 mt-0.5">Vos données sont sauvegardées localement. La sync reprendra automatiquement dès que vous êtes connecté.</p>
          </div>
        </div>
      )}

      {/* ── Conflict resolution panel ── */}
      {conflicts.length > 0 && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/8 space-y-3 animate-fadeUp">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" />
            Conflit détecté — solde négatif
          </div>
          <p className="text-xs text-muted-foreground">
            Après synchronisation, votre solde serait négatif à cause de ces transactions reçues d'un autre appareil :
          </p>
          <div className="space-y-1.5">
            {conflicts.map(c => (
              <div key={c.uuid} className="flex items-center justify-between text-xs bg-card/50 rounded-lg px-3 py-2">
                <span className="text-foreground">{c.category}</span>
                <span className="text-muted-foreground">{c.date}</span>
                <span className="text-red-400 font-semibold">−{c.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
          {mergeResult && (
            <p className="text-xs text-amber-400/80">
              Solde résultant : <strong>{mergeResult.newBalance.toFixed(2)}</strong> {settings?.defaultCurrency || 'EUR'}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
              onClick={handleResolveRemove}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Supprimer les conflits
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs"
              onClick={handleResolveKeep}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Garder tout
            </Button>
          </div>
        </div>
      )}

      {/* ── NO GROUP: setup ── */}
      {!groupId && view === 'main' && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5 text-center space-y-4">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <Link2Off className="h-7 w-7 text-primary/60" />
            </div>
            <div>
              <p className="font-semibold">Aucun groupe de sync</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Créez un groupe sur cet appareil, puis scannez le QR ou entrez le code sur vos autres appareils. Un seul scan suffit — la sync est ensuite automatique et permanente.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleCreateGroup} className="flex-1" data-testid="btn-create-group">
                <Monitor className="h-4 w-4 mr-2" />
                Créer un groupe
              </Button>
              <Button variant="outline" onClick={() => setView('join')} className="flex-1" data-testid="btn-join-group">
                <Smartphone className="h-4 w-4 mr-2" />
                Rejoindre
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── JOIN VIEW: enter code ── */}
      {view === 'join' && (
        <div className="space-y-4 animate-fadeUp">
          <Button variant="ghost" size="sm" onClick={() => setView('main')} className="text-muted-foreground -ml-1">
            ← Retour
          </Button>
          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="text-center space-y-1">
              <QrCode className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-semibold">Scanner un QR Code</p>
            </div>
            
            <div className="border border-card-border rounded-xl overflow-hidden bg-black/5 p-2">
               <QrScanner 
                 onScan={(text) => handleJoinGroup(text)} 
                 onError={(err) => console.log(err)} 
               />
            </div>

            <div className="text-center pt-2">
              <p className="text-xs text-muted-foreground mb-2">Ou entrer le code manuellement</p>
              <Input
                value={inputCode}
                onChange={e => setInputCode(e.target.value.toUpperCase())}
                placeholder="FIN-AB3CD7"
                className="font-mono text-center text-lg tracking-widest mb-2"
                data-testid="input-group-code"
              />
              <Button
                onClick={() => handleJoinGroup()}
                disabled={!inputCode.trim() || status === 'syncing' || !isOnline}
                className="w-full"
                data-testid="btn-confirm-join"
              >
                {status === 'syncing' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connexion...</> : 'Rejoindre avec le code'}
              </Button>
            </div>
            {!isOnline && <p className="text-xs text-center text-amber-400">Connexion internet requise pour rejoindre un groupe</p>}
          </div>
        </div>
      )}

      {/* ── ACTIVE GROUP ── */}
      {groupId && view === 'main' && (
        <div className="space-y-4">
          {/* Group card */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'}`} />
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {isOnline ? 'Sync active' : 'En attente de connexion'}
                </p>
              </div>
              <Link2 className="h-4 w-4 text-primary" />
            </div>

            {/* Group ID display */}
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground mb-1">Code du groupe</p>
              <p className="font-mono font-bold text-2xl tracking-widest text-primary">{groupId}</p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyCode}
                className="text-xs"
                data-testid="btn-copy-code"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copiedCode ? 'Copié !' : 'Copier le code'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView('qr')}
                className="text-xs"
                data-testid="btn-show-qr"
              >
                <QrCode className="h-3.5 w-3.5 mr-1.5" />
                QR Code
              </Button>
            </div>
          </div>

          {/* Status message */}
          {statusMsg && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-card/50 border border-card-border ${statusColor}`}>
              {statusIcon}
              <span>{statusMsg}</span>
              {lastSync && status !== 'syncing' && (
                <span className="ml-auto text-muted-foreground">{formatLastSync(lastSync)}</span>
              )}
            </div>
          )}

          {/* Sync button */}
          <Button
            onClick={() => handleSync(false)}
            disabled={status === 'syncing' || !isOnline}
            className="w-full"
            data-testid="btn-manual-sync"
          >
            {status === 'syncing'
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Synchronisation...</>
              : <><RefreshCw className="h-4 w-4 mr-2" />Synchroniser maintenant</>
            }
          </Button>

          {/* Info callout */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground leading-relaxed">
            <span className="text-primary font-medium">⚡ Sync temps réel active.</span> Dès qu'un autre appareil ajoute une transaction, vous la recevez automatiquement — sans rien faire. Le code <span className="font-mono text-foreground">{groupId}</span> ne change jamais.
          </div>

          {/* Leave group */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLeaveGroup}
            className="w-full text-xs text-muted-foreground hover:text-destructive"
          >
            Quitter ce groupe de sync
          </Button>
        </div>
      )}

      {/* ── QR VIEW ── */}
      {groupId && view === 'qr' && (
        <div className="space-y-4 animate-fadeUp">
          <Button variant="ghost" size="sm" onClick={() => setView('main')} className="text-muted-foreground -ml-1">
            ← Retour
          </Button>
          <div className="glass rounded-2xl p-6 flex flex-col items-center gap-5">
            <div>
              <p className="font-semibold text-center mb-1">Scanner pour rejoindre</p>
              <p className="text-xs text-muted-foreground text-center">Scannez ce QR avec l'autre appareil — une seule fois suffit</p>
            </div>
            <div className="p-4 bg-white rounded-2xl shadow-xl shadow-black/30">
              <React.Suspense fallback={<div className="w-44 h-44 flex items-center justify-center text-muted-foreground text-xs">Chargement...</div>}>
                <LazyQRCode value={groupId} size={176} />
              </React.Suspense>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Ou entrez manuellement le code :</p>
              <p className="font-mono font-bold text-xl tracking-widest text-primary mt-1">{groupId}</p>
            </div>
          </div>
        </div>
      )}

      <InfoModal
        title="Synchronisation temps réel"
        description={`Sync permanente entre appareils via ${backendLabel}. Créez un groupe une fois, partagez le code — la sync est ensuite automatique et instantanée. Fonctionne hors ligne : vos données sont toujours sauvegardées localement.`}
      />
    </div>
  );
}
