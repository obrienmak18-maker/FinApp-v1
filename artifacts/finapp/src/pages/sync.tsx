import React, { useState, useRef, useEffect } from 'react';
import { db } from '../services/db';
import { firebaseDb, ref, set, get, generateSessionId } from '../services/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Info, Monitor, Smartphone, QrCode, Camera, CheckCircle2 } from 'lucide-react';
import InfoModal from '../components/InfoModal';
import { QRCodeSVG } from 'qrcode.react';

type Mode = 'select' | 'host' | 'client';

function useLog() {
  const [logs, setLogs] = useState<string[]>([]);
  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  const clearLogs = () => setLogs([]);
  return { logs, addLog, clearLogs };
}

export default function Sync() {
  const [mode, setMode] = useState<Mode>('select');
  const [sessionId, setSessionId] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const { logs, addLog, clearLogs } = useLog();
  const scannerRef = useRef<HTMLDivElement>(null);
  const qrScannerRef = useRef<unknown>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = () => {
    if (qrScannerRef.current) {
      try {
        (qrScannerRef.current as { clear: () => void }).clear();
      } catch { /* ignore */ }
      qrScannerRef.current = null;
    }
  };

  const startHost = async () => {
    setMode('host');
    clearLogs();
    setDone(false);
    const id = generateSessionId();
    setSessionId(id);
    addLog('Session créée: ' + id);
    setSyncing(true);
    try {
      addLog('Chargement des données locales...');
      const transactions = await db.transactions.toArray();
      const categories = await db.categories.toArray();
      const budgets = await db.budgets.toArray();
      const projects = await db.projects.toArray();
      addLog(`${transactions.length} transactions, ${categories.length} catégories chargées`);

      addLog('Envoi vers Firebase...');
      await set(ref(firebaseDb, `sessions/${id}`), { transactions, categories, budgets, projects, timestamp: Date.now() });
      addLog('Données synchronisées avec succès !');
      setDone(true);
    } catch (e) {
      addLog('Erreur: ' + String(e));
    } finally {
      setSyncing(false);
    }
  };

  const startClient = () => {
    setMode('client');
    clearLogs();
    setDone(false);
    addLog('Mode client activé. Entrez le code de session.');
  };

  const startQRScan = async () => {
    setCameraError('');
    addLog('Demande d\'accès à la caméra...');
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      addLog('Caméra autorisée. Pointez vers le QR Code.');
      if (!scannerRef.current) return;
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      stopScanner();
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false);
      qrScannerRef.current = scanner;
      scanner.render(
        (text: string) => {
          setInputCode(text);
          addLog('QR Code scanné: ' + text);
          stopScanner();
        },
        () => {}
      );
    } catch {
      setCameraError("Accès à la caméra refusé. Veuillez entrer le code manuellement ou autoriser la caméra dans les paramètres de votre navigateur.");
      addLog('Erreur: accès caméra refusé');
    }
  };

  const joinSession = async () => {
    if (!inputCode.trim()) return;
    setSyncing(true);
    addLog('Connexion à la session: ' + inputCode);
    try {
      const snapshot = await get(ref(firebaseDb, `sessions/${inputCode}`));
      if (!snapshot.exists()) { addLog('Session introuvable.'); setSyncing(false); return; }
      const data = snapshot.val();
      addLog('Données reçues. Fusion en cours...');

      const localTx = await db.transactions.toArray();
      const remoteTx = data.transactions || [];
      const merged: typeof localTx = [...localTx];
      let added = 0;
      for (const rt of remoteTx) {
        const exists = localTx.some(lt =>
          lt.date === rt.date && lt.montant === rt.montant && lt.categorie === rt.categorie
        );
        if (!exists) { merged.push(rt); added++; }
      }
      await db.transactions.clear();
      for (const t of merged) {
        const { id, ...rest } = t;
        await db.transactions.add(rest);
      }
      addLog(`${added} nouvelles transactions ajoutées.`);
      addLog('Synchronisation terminée !');
      setDone(true);
    } catch (e) {
      addLog('Erreur: ' + String(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-4 md:p-6 animate-fadeUp space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Synchronisation</h1>
        <Button variant="ghost" size="icon" onClick={() => setShowInfo(true)} data-testid="btn-info">
          <Info className="h-4 w-4" />
        </Button>
      </header>

      {mode === 'select' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <button
            onClick={startHost}
            className="p-6 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 text-left space-y-3 transition-all active:scale-95"
            data-testid="btn-mode-host"
          >
            <Monitor className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">Ordinateur (Hôte)</p>
              <p className="text-sm text-muted-foreground">Partager mes données vers un autre appareil</p>
            </div>
          </button>
          <button
            onClick={startClient}
            className="p-6 rounded-xl border-2 border-muted bg-muted/20 hover:bg-muted/40 text-left space-y-3 transition-all active:scale-95"
            data-testid="btn-mode-client"
          >
            <Smartphone className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-semibold">Mobile (Client)</p>
              <p className="text-sm text-muted-foreground">Recevoir des données depuis un autre appareil</p>
            </div>
          </button>
        </div>
      )}

      {mode === 'host' && sessionId && (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => { setMode('select'); stopScanner(); }} className="text-muted-foreground">
            ← Retour
          </Button>
          <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-card/50 border border-card-border">
            <div className="p-4 bg-white rounded-xl shadow-lg">
              <QRCodeSVG value={sessionId} size={180} />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Code de session</p>
              <p className="font-mono font-bold text-lg tracking-widest text-primary">{sessionId}</p>
            </div>
            {done && <div className="flex items-center gap-2 text-emerald-500 text-sm"><CheckCircle2 className="h-4 w-4" /> Données partagées !</div>}
          </div>
        </div>
      )}

      {mode === 'client' && (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => { setMode('select'); stopScanner(); }} className="text-muted-foreground">
            ← Retour
          </Button>
          <div className="space-y-3 p-4 rounded-xl bg-card/50 border border-card-border">
            <div className="flex gap-2">
              <Input
                value={inputCode}
                onChange={e => setInputCode(e.target.value)}
                placeholder="finapp-sync-XXXXXXX"
                className="font-mono"
                data-testid="input-session-code"
              />
              <Button onClick={joinSession} disabled={syncing || !inputCode} data-testid="btn-join">
                {syncing ? 'Sync...' : 'Rejoindre'}
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={startQRScan} className="w-full" data-testid="btn-scan-qr">
              <Camera className="h-4 w-4 mr-2" /> Scanner le QR Code
            </Button>
            {cameraError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">{cameraError}</div>
            )}
            <div id="qr-reader" ref={scannerRef} />
            {done && <div className="flex items-center gap-2 text-emerald-500 text-sm"><CheckCircle2 className="h-4 w-4" /> Synchronisation réussie !</div>}
          </div>
        </div>
      )}

      {/* Terminal logs */}
      {logs.length > 0 && (
        <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs text-emerald-400 space-y-1 max-h-52 overflow-y-auto">
          {logs.map((l, i) => <div key={i}>{l}</div>)}
          <div ref={logsEndRef} />
        </div>
      )}

      <InfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="Synchronisation"
        description="Synchronisez vos données entre appareils via Firebase. L'hôte génère un QR Code ou un code de session. Le client scan ou entre ce code pour recevoir les données."
      />
    </div>
  );
}
