import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Button } from '@/components/ui/button';
import { Fingerprint, Lock, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LockScreen() {
  const { settings, setIsLocked } = useAppContext();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setTimeout(() => setLockoutTime(t => t - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (attempts >= 3) {
      setAttempts(0); // reset attempts after lockout completes
    }
    return undefined;
  }, [lockoutTime, attempts]);

  const handlePress = (num: string) => {
    if (lockoutTime > 0) return;
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        verify(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (lockoutTime > 0) return;
    setPin(p => p.slice(0, -1));
  };

  const verify = (entered: string) => {
    if (entered === settings?.pinCode) {
      setIsLocked(false);
      navigate('/dashboard');
    } else {
      setError(true);
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setLockoutTime(30); // lockout for 30 seconds
        toast({
          title: "Sécurité renforcée",
          description: "Trop de tentatives incorrectes. Clavier verrouillé pour 30 secondes.",
          variant: "destructive",
        });
      }
      setTimeout(() => {
        setPin('');
        setError(false);
      }, 500);
    }
  };

  const handleBiometrics = () => {
    if (lockoutTime > 0) return;
    if (!settings?.biometricsEnabled) {
      toast({
        title: "Connexion biométrique",
        description: "Veuillez activer la connexion biométrique (empreinte / visage) dans les Paramètres.",
        variant: "destructive",
      });
      return;
    }
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      if (navigator.vibrate) navigator.vibrate(100);
      setIsLocked(false);
      navigate('/dashboard');
    }, 1800);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 animate-zoomIn balance-gradient text-foreground">
      <div className="w-full max-w-sm text-center space-y-8 glass p-8 rounded-3xl border border-card-border shadow-2xl relative overflow-hidden">
        {/* Background glow orbs */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative">
          <div className="w-20 h-20 bg-primary/15 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-primary/20 animate-float">
            <span className="text-3xl text-primary font-bold">{settings?.username?.[0] || 'U'}</span>
          </div>
          {lockoutTime > 0 && (
            <div className="absolute -bottom-1 -right-1 bg-destructive p-1.5 rounded-full border-2 border-background shadow-lg">
              <ShieldAlert className="h-4 w-4 text-destructive-foreground" />
            </div>
          )}
        </div>
        
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Bonjour, {settings?.username || 'Utilisateur'}</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {lockoutTime > 0 
              ? `Clavier verrouillé pendant ${lockoutTime}s` 
              : "Entrez votre code PIN pour déverrouiller"
            }
          </p>
        </div>

        <div className="flex justify-center gap-4 py-2">
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`w-4.5 h-4.5 rounded-full border transition-all duration-300 ${
                i < pin.length 
                  ? 'bg-primary border-primary scale-110 shadow-lg shadow-primary/30' 
                  : 'bg-muted/30 border-muted-foreground/30'
              } ${error ? 'bg-destructive border-destructive animate-pulse' : ''}`} 
            />
          ))}
        </div>

        {error && lockoutTime === 0 && (
          <p className="text-destructive text-xs font-medium animate-pulse">
            Code incorrect. {3 - attempts} tentatives restantes.
          </p>
        )}

        <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <Button 
              key={num} 
              variant="outline" 
              className="h-16 text-xl rounded-2xl border-card-border/60 hover:bg-white/5 hover:text-foreground active:scale-95 transition-all shadow-sm" 
              onClick={() => handlePress(num.toString())}
              disabled={lockoutTime > 0}
            >
              {num}
            </Button>
          ))}
          <Button 
            variant="ghost" 
            className="h-16 rounded-2xl flex items-center justify-center text-primary hover:bg-primary/15 hover:text-primary active:scale-95 transition-all"
            onClick={handleBiometrics}
            disabled={lockoutTime > 0}
          >
            <Fingerprint className="h-7 w-7" />
          </Button>
          <Button 
            variant="outline" 
            className="h-16 text-xl rounded-2xl border-card-border/60 hover:bg-white/5 hover:text-foreground active:scale-95 transition-all shadow-sm" 
            onClick={() => handlePress('0')}
            disabled={lockoutTime > 0}
          >
            0
          </Button>
          <Button 
            variant="outline" 
            className="h-16 text-xl rounded-2xl border-card-border/60 hover:bg-white/5 hover:text-foreground active:scale-95 transition-all shadow-sm" 
            onClick={handleBackspace}
            disabled={lockoutTime > 0}
          >
            ⌫
          </Button>
        </div>
      </div>

      {/* High-fidelity Biometric scanning overlay */}
      {scanning && (
        <div className="fixed inset-0 bg-background/85 backdrop-blur-md flex items-center justify-center z-50 animate-fadeIn">
          <div className="w-72 p-8 bg-card/95 border border-card-border rounded-3xl shadow-2xl flex flex-col items-center justify-center space-y-6 text-center animate-zoomIn relative">
            <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-transparent opacity-10 rounded-3xl blur-md pointer-events-none" />
            <div className="relative">
              <div className="w-24 h-24 bg-primary/15 rounded-full flex items-center justify-center border-2 border-primary/40 animate-pulse">
                <Fingerprint className="h-12 w-12 text-primary animate-bounce" />
              </div>
              <div className="absolute -inset-2 bg-primary/10 rounded-full blur-lg animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-lg">Scan biométrique</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Vérification de l'identité en cours...</p>
            </div>
            <div className="w-full bg-muted/50 h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full animate-widthGrow" style={{ animationDuration: '1.8s' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
