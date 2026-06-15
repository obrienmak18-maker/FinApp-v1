import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronRight, Sparkles, Shield, Globe } from 'lucide-react';

const CURRENCIES = [
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'USD', label: 'Dollar US', symbol: '$' },
  { code: 'CHF', label: 'Franc Suisse', symbol: 'CHF' },
  { code: 'GBP', label: 'Livre Sterling', symbol: '£' },
  { code: 'CDF', label: 'Franc Congolais', symbol: 'FC' },
  { code: 'XAF', label: 'Franc CFA', symbol: 'FCFA' },
  { code: 'MAD', label: 'Dirham Marocain', symbol: 'MAD' },
  { code: 'TND', label: 'Dinar Tunisien', symbol: 'TND' },
  { code: 'CAD', label: 'Dollar Canadien', symbol: 'CAD' },
];

const STEPS = [
  { title: 'Bienvenue', icon: Sparkles },
  { title: 'Votre nom', icon: null },
  { title: 'Sécurité', icon: Shield },
  { title: 'Devise', icon: Globe },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const { updateSettings } = useAppContext();
  const navigate = useNavigate();

  const handleNext = () => setStep(s => s + 1);

  const handleComplete = async () => {
    await updateSettings({
      username: username || 'Vous',
      pinCode: pin,
      defaultCurrency: currency,
      themeMode: 'dark',
      customColors: '239 84% 67%',
      aiPreferences: '',
    });
    navigate('/dashboard');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden">
      {/* Background orbs for onboarding */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full blur-[100px] animate-orb"
          style={{ background: 'radial-gradient(circle, hsl(239 84% 67% / 0.2), transparent 70%)' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full blur-[100px] animate-orb-2"
          style={{ background: 'radial-gradient(circle, hsl(271 91% 65% / 0.15), transparent 70%)' }} />
      </div>

      {/* Step indicator */}
      <div className="flex gap-2 mb-8 relative z-10">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i + 1 <= step ? 'bg-primary w-8' : 'bg-card-border w-4'
            }`}
          />
        ))}
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="glass-strong rounded-3xl p-8 shadow-2xl shadow-black/40 border border-card-border animate-zoomIn">

          {/* Step 1 — Welcome */}
          {step === 1 && (
            <div className="text-center space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/40 animate-float">
                  <span className="text-4xl text-primary-foreground font-black">F</span>
                </div>
                <div className="absolute -inset-2 bg-primary/20 rounded-2xl blur-xl -z-10" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-gradient">FinApp</h1>
                <p className="text-muted-foreground mt-2 text-sm">Votre sanctuaire financier personnel.<br />100% privé, 100% local.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 py-2">
                {[
                  ['🔐', 'Données\nlocales'],
                  ['📊', 'Analyses\nIA'],
                  ['🌍', 'Multi-\ndevises'],
                ].map(([icon, label]) => (
                  <div key={label} className="p-3 rounded-xl bg-muted/40 border border-card-border text-center">
                    <span className="text-2xl block mb-1">{icon}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-pre-line leading-tight">{label}</span>
                  </div>
                ))}
              </div>
              <Button onClick={handleNext} className="w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/30" data-testid="btn-start">
                Commencer <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2 — Name */}
          {step === 2 && (
            <div className="space-y-6 animate-fadeUp">
              <div>
                <h2 className="text-2xl font-bold">Comment vous appelez-vous ?</h2>
                <p className="text-muted-foreground text-sm mt-1">Pour personnaliser votre tableau de bord</p>
              </div>
              <div className="space-y-2">
                <Label>Prénom</Label>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Alex"
                  className="h-12 text-base"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && username && handleNext()}
                  data-testid="input-username"
                />
              </div>
              <Button onClick={handleNext} disabled={!username.trim()} className="w-full h-12 text-base font-semibold rounded-xl" data-testid="btn-next-name">
                Continuer <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 3 — PIN */}
          {step === 3 && (
            <div className="space-y-6 animate-fadeUp">
              <div>
                <div className="w-12 h-12 bg-primary/15 rounded-xl flex items-center justify-center mb-3">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Protégez votre app</h2>
                <p className="text-muted-foreground text-sm mt-1">Optionnel — Code PIN à 4 chiffres</p>
              </div>
              <div className="space-y-2">
                <Label>Code PIN (optionnel)</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="h-12 text-center text-2xl tracking-[0.5em] font-bold"
                  data-testid="input-pin"
                />
              </div>
              {pin.length > 0 && pin.length < 4 && (
                <p className="text-xs text-muted-foreground">{4 - pin.length} chiffre(s) restant(s)</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleNext} className="flex-1 h-11" data-testid="btn-skip-pin">
                  Passer
                </Button>
                <Button onClick={handleNext} disabled={pin.length > 0 && pin.length < 4} className="flex-1 h-11 font-semibold" data-testid="btn-next-pin">
                  Continuer <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4 — Currency */}
          {step === 4 && (
            <div className="space-y-6 animate-fadeUp">
              <div>
                <div className="w-12 h-12 bg-primary/15 rounded-xl flex items-center justify-center mb-3">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Devise principale</h2>
                <p className="text-muted-foreground text-sm mt-1">Les montants seront convertis dans cette devise</p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {CURRENCIES.map(c => (
                  <button
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      currency === c.code
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-card-border hover:border-muted-foreground text-foreground'
                    }`}
                    data-testid={`currency-${c.code}`}
                  >
                    <p className="font-bold text-sm">{c.symbol}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.label}</p>
                  </button>
                ))}
              </div>
              <Button onClick={handleComplete} className="w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/30" data-testid="btn-finish">
                Démarrer FinApp 🚀
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
