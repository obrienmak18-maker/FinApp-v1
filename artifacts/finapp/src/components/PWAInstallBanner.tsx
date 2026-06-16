import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

// iOS detection
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Check if already running as standalone PWA
function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or user already dismissed
    if (isStandalone()) return;
    if (sessionStorage.getItem('pwa-banner-dismissed')) return;

    // iOS: show manual instructions banner
    if (isIOS()) {
      setShowIOSBanner(true);
      return;
    }

    // Android/Chrome: listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
    dismiss();
  };

  const dismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSBanner(false);
    sessionStorage.setItem('pwa-banner-dismissed', '1');
  };

  if (dismissed) return null;

  // Android install banner
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 lg:left-auto lg:right-6 lg:bottom-6 lg:w-80 animate-fadeUp">
        <div className="glass-strong rounded-2xl border border-primary/30 p-4 shadow-2xl shadow-black/40">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Installer FinApp</p>
              <p className="text-xs text-muted-foreground mt-0.5">Accédez à l'appli depuis votre écran d'accueil, même hors ligne.</p>
            </div>
            <button
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={dismiss}
              className="flex-1 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground border border-border hover:border-muted-foreground/50 transition-all"
            >
              Plus tard
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all flex items-center justify-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Installer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // iOS instructions banner
  if (showIOSBanner) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 lg:left-auto lg:right-6 lg:bottom-6 lg:w-80 animate-fadeUp">
        <div className="glass-strong rounded-2xl border border-primary/30 p-4 shadow-2xl shadow-black/40">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center shrink-0 text-lg">
              📱
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Ajouter à l'écran d'accueil</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Dans Safari, appuyez sur <strong>Partager</strong> <span className="text-[11px]">↑</span> puis choisissez <strong>«&nbsp;Sur l'écran d'accueil&nbsp;»</strong> pour utiliser FinApp comme une app native.
              </p>
            </div>
            <button
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
