import React, { useState, useRef, useEffect } from 'react';
import { db } from '../services/db';
import { firebaseDb, ref, set, get, generateSessionId, sanitizeForFirebase } from '../services/firebase';
import {
  supabasePushSession, supabasePullSession, SUPABASE_AVAILABLE,
  supabaseCheckReady, SupabaseSetupError,
} from '../services/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Info, Monitor, Smartphone, Camera, CheckCircle2, Wifi, Database, AlertTriangle, Copy, Check } from 'lucide-react';
import InfoModal from '../components/InfoModal';
import { QRCodeSVG } from 'qrcode.react';

type Mode = 'select' | 'host' | 'client';
type Backend = 'supabase' | 'firebase' | 'checking';

const SETUP_SQL = `create table if not exists public.sync_sessions (
  session_id  text        primary key,
  payload     jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
alter table public.sync_sessions enable row level security;
create policy "allow all on sync_sessions"
  on public.sync_sessions for all using (true) with check (true);`;

function useLog() {
  const [logs, setLogs] = useState<string[]>([]);
  const add = (msg: string) => setLogs(p => [...p, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  const clear = () => setLogs([]);
  return { logs, add, clear };
}

export default function Sync() {
  const [mode, setMode] = useState<Mode>('select');
  const [backend, setBackend] = useState<Backend>('checking');
  const [sessionId, setSessionId] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [copied, setCopied] = useState(false);
  const { logs, add, clear } = useLog();
  const scannerRef = useRef<HTMLDivElement>(null);
  const qrScannerRef = useRef<unknown>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Determine active backend on mount
  useEffect(() => {
    if (!SUPABASE_AVAILABLE) { setBackend('firebase'); return; }
    supabaseCheckReady().then(ok => setBackend(ok ? 'supabase' : 'firebase'));
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => { return () => stopScanner(); }, []);

  const stopScanner = () => {
    if (qrScannerRef.current) {
      try { (qrScannerRef.current as { clear: () => void }).clear(); } catch { /* ignore */ }
      qrScannerRef.current = null;
    }
  };

  const startHost = async () => {
    setMode('host');
    clear();
    setDone(false);
    const id = generateSessionId();
    setSessionId(id);
    add('Session créée : ' + id);
    setSyncing(true);
    try {
      add('Chargement des données locales…');
      const [transactions, categories, budgets, projects] = await Promise.all([
        db.transactions.toArray(),
        db.categories.toArray(),
        db.budgets.toArray(),
        db.projects.toArray(),
      ]);
      add(`${transactions.length} transactions, ${categories.length} catégories chargées`);

      const payload = { transactions, categories, budgets, projects, timestamp: Date.now() };

      if (backend === 'supabase') {
        add('Envoi via Supabase…');
        await supabasePushSession(id, payload);
        add('✓ Synchronisé via Supabase !');
      } else {
        add('Envoi via Firebase…');
        await set(ref(firebaseDb, `sessions/${id}`), sanitizeForFirebase(payload));
        add('✓ Synchronisé via Firebase !');
      }
      setDone(true);
    } catch (e) {
      if (e instanceof SupabaseSetupError) {
        add('⚠ Table Supabase manquante — tentative via Firebase…');
        setBackend('firebase');
      } else {
        add('Erreur : ' + String(e));
      }
    } finally {
      setSyncing(false);
    }
  };

  const startClient = () => {
    setMode('client');
    clear();
    setDone(false);
    add('Mode client activé. Entrez le code de session.');
  };

  const startQRScan = async () => {
    setCameraError('');
    add("Demande d'accès à la caméra…");
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      add('Caméra autorisée. Pointez vers le QR Code.');
      if (!scannerRef.current) return;
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      stopScanner();
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false);
      qrScannerRef.current = scanner;
      scanner.render(
        (text: string) => { setInputCode(text); add('QR Code scanné : ' + text); stopScanner(); },
        () => {}
      );
    } catch {
      setCameraError('Accès à la caméra refusé. Veuillez entrer le code manuellement.');
      add('Erreur : accès caméra refusé');
    }
  };

  const joinSession = async () => {
    if (!inputCode.trim()) return;
    setSyncing(true);
    add('Connexion à la session : ' + inputCode);
    try {
      let data: { transactions?: object[]; categories?: object[]; budgets?: object[]; projects?: object[] } | null = null;

      if (backend === 'supabase') {
        add('Récupération via Supabase…');
        data = await supabasePullSession(inputCode);
      } else {
        add('Récupération via Firebase…');
        const snap = await get(ref(firebaseDb, `sessions/${inputCode}`));
        if (!snap.exists()) { add('Session introuvable.'); setSyncing(false); return; }
        data = snap.val();
      }

      if (!data) { add('Session introuvable ou expirée.'); setSyncing(false); return; }

      add('Données reçues. Fusion en cours…');
      const localTx = await db.transactions.toArray();
      const remoteTx = (data.transactions || []) as typeof localTx;
      let added = 0;
      const merged = [...localTx];
      for (const rt of remoteTx) {
        const dup = localTx.some(lt => lt.date === rt.date && lt.montant === rt.montant && lt.categorie === rt.categorie);
        if (!dup) { merged.push(rt); added++; }
      }
      await db.transactions.clear();
      for (const t of merged) {
        const { id, ...rest } = t;
        await db.transactions.add(rest);
      }
      add(`${added} nouvelles transactions ajoutées.`);
      add('✓ Synchronisation terminée !');
      setDone(true);
    } catch (e) {
      if (e instanceof SupabaseSetupError) {
        add('⚠ Table Supabase manquante — relancez avec Firebase.');
        setBackend('firebase');
      } else {
        add('Erreur : ' + String(e));
      }
    } finally {
      setSyncing(false);
    }
  };

  const copySetupSQL = async () => {
    await navigator.clipboard.writeText(SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const backendLabel = backend === 'checking' ? '…' : backend === 'supabase' ? 'Supabase' : 'Firebase';
  const backendColor = backend === 'supabase' ? 'text-emerald-400' : backend === 'firebase' ? 'text-orange-400' : 'text-muted-foreground';

  return (
    <div className="p-4 md:p-6 animate-fadeUp space-y-4 max-w-2xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Synchronisation</h1>
          <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${backendColor}`}>
            <Database className="h-3 w-3" />
            Moteur actif : <strong>{backendLabel}</strong>
          </p>
        </div>
        <div className="flex gap-1">
          {SUPABASE_AVAILABLE && backend === 'firebase' && (
            <Button variant="ghost" size="sm" onClick={() => setShowSetup(s => !s)} className="text-amber-400 hover:text-amber-300 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Config Supabase
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setShowInfo(true)} data-testid="btn-info">
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Supabase setup panel */}
      {showSetup && (
        <div className="glass rounded-2xl p-4 space-y-3 border border-amber-500/20 animate-fadeUp">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-300">Table Supabase non configurée</p>
              <p className="text-muted-foreground text-xs mt-1">Copiez ce SQL et exécutez-le dans le
                {' '}<a href="https://supabase.com/dashboard/project/pjrwkppngrpkaedfuunh/sql/new"
                  target="_blank" rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2">SQL Editor Supabase</a>.
              </p>
            </div>
          </div>
          <div className="relative">
            <pre className="text-xs text-emerald-300 bg-zinc-950/80 rounded-xl p-3 overflow-x-auto leading-relaxed">
              {SETUP_SQL}
            </pre>
            <button
              onClick={copySetupSQL}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Après exécution, rechargez la page pour activer Supabase.</p>
        </div>
      )}

      {mode === 'select' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <button
            onClick={startHost}
            className="glass p-6 rounded-2xl border-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5 text-left space-y-3 transition-all active:scale-95 group"
            data-testid="btn-mode-host"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-all">
              <Monitor className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Appareil source</p>
              <p className="text-sm text-muted-foreground mt-1">Partager mes données via QR Code</p>
            </div>
          </button>
          <button
            onClick={startClient}
            className="glass p-6 rounded-2xl border-2 border-card-border hover:border-muted-foreground/40 text-left space-y-3 transition-all active:scale-95 group"
            data-testid="btn-mode-client"
          >
            <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center group-hover:bg-muted/70 transition-all">
              <Smartphone className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">Appareil cible</p>
              <p className="text-sm text-muted-foreground mt-1">Recevoir les données d'un autre appareil</p>
            </div>
          </button>
        </div>
      )}

      {mode === 'host' && sessionId && (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => { setMode('select'); stopScanner(); }} className="text-muted-foreground">
            ← Retour
          </Button>
          <div className="glass flex flex-col items-center gap-4 p-6 rounded-2xl">
            <div className="p-4 bg-white rounded-2xl shadow-xl shadow-black/30">
              <QRCodeSVG value={sessionId} size={180} />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Code de session</p>
              <p className="font-mono font-bold text-xl tracking-widest text-primary">{sessionId}</p>
            </div>
            {syncing && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Wifi className="h-4 w-4 animate-pulse" /> Envoi en cours…
              </div>
            )}
            {done && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" /> Données partagées via {backendLabel} !
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'client' && (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => { setMode('select'); stopScanner(); }} className="text-muted-foreground">
            ← Retour
          </Button>
          <div className="glass space-y-3 p-4 rounded-2xl">
            <div className="flex gap-2">
              <Input
                value={inputCode}
                onChange={e => setInputCode(e.target.value)}
                placeholder="finapp-sync-XXXXXXX"
                className="font-mono"
                data-testid="input-session-code"
              />
              <Button onClick={joinSession} disabled={syncing || !inputCode.trim()} data-testid="btn-join">
                {syncing ? 'Sync…' : 'Rejoindre'}
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={startQRScan} className="w-full" data-testid="btn-scan-qr">
              <Camera className="h-4 w-4 mr-2" /> Scanner le QR Code
            </Button>
            {cameraError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">{cameraError}</div>
            )}
            <div id="qr-reader" ref={scannerRef} />
            {done && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" /> Synchronisation réussie !
              </div>
            )}
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="rounded-xl bg-zinc-950/80 border border-zinc-800 p-4 font-mono text-xs text-emerald-400 space-y-1 max-h-48 overflow-y-auto">
          {logs.map((l, i) => <div key={i}>{l}</div>)}
          <div ref={logsEndRef} />
        </div>
      )}

      <InfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="Synchronisation"
        description={`Sync entre appareils via ${backendLabel}. L'hôte génère un QR Code, le client le scanne pour recevoir les données. Fonctionne hors-ligne si le cache est actif.`}
      />
    </div>
  );
}
