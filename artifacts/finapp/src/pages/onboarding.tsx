import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
      username,
      pinCode: pin,
      defaultCurrency: currency,
      themeMode: 'dark',
      customColors: '239 84% 67%',
      aiPreferences: ''
    });
    navigate('/dashboard');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 animate-zoomIn">
      <div className="w-full max-w-md space-y-8 bg-card/50 backdrop-blur-xl p-8 rounded-2xl border border-card-border shadow-2xl">
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto animate-float">
              <span className="text-4xl text-primary font-bold">F</span>
            </div>
            <h1 className="text-3xl font-bold">Bienvenue sur FinApp</h1>
            <p className="text-muted-foreground">Votre sanctuaire financier personnel.</p>
            <Button onClick={handleNext} className="w-full mt-8">Commencer</Button>
          </div>
        )}
        
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Comment vous appelez-vous ?</h2>
            <div className="space-y-2">
              <Label>Prénom</Label>
              <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Alex" />
            </div>
            <Button onClick={handleNext} disabled={!username} className="w-full">Continuer</Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Sécurisez votre application</h2>
            <p className="text-sm text-muted-foreground">Optionnel. Entrez un code PIN à 4 chiffres.</p>
            <div className="space-y-2">
              <Label>Code PIN</Label>
              <Input type="password" maxLength={4} value={pin} onChange={e => setPin(e.target.value)} placeholder="1234" />
            </div>
            <Button onClick={handleNext} className="w-full">Continuer</Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Devise principale</h2>
            <div className="space-y-2">
              <Label>Devise</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={currency} 
                onChange={e => setCurrency(e.target.value)}
              >
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dollar ($)</option>
                <option value="CHF">Franc Suisse (CHF)</option>
              </select>
            </div>
            <Button onClick={handleComplete} className="w-full">Terminer</Button>
          </div>
        )}
      </div>
    </div>
  );
}
