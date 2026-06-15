import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Button } from '@/components/ui/button';

export default function Lock() {
  const { settings, setIsLocked } = useAppContext();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const navigate = useNavigate();

  const handlePress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        verify(newPin);
      }
    }
  };

  const handleBackspace = () => setPin(p => p.slice(0, -1));

  const verify = (entered: string) => {
    if (entered === settings?.pinCode) {
      setIsLocked(false);
      navigate('/dashboard');
    } else {
      setError(true);
      setAttempts(a => a + 1);
      setTimeout(() => {
        setPin('');
        setError(false);
      }, 500);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 animate-zoomIn">
      <div className="w-full max-w-sm text-center space-y-8">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl text-primary font-bold">{settings?.username?.[0] || 'U'}</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold">Bonjour, {settings?.username}</h1>
          <p className="text-muted-foreground mt-2">Entrez votre code PIN</p>
        </div>

        <div className="flex justify-center gap-4 py-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full transition-colors ${i < pin.length ? 'bg-primary' : 'bg-muted'} ${error ? 'bg-destructive' : ''}`} />
          ))}
        </div>

        {error && <p className="text-destructive text-sm animate-pulse">Code incorrect. {3 - attempts} tentatives restantes.</p>}

        <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <Button key={num} variant="outline" className="h-16 text-xl rounded-2xl" onClick={() => handlePress(num.toString())}>
              {num}
            </Button>
          ))}
          <div />
          <Button variant="outline" className="h-16 text-xl rounded-2xl" onClick={() => handlePress('0')}>0</Button>
          <Button variant="outline" className="h-16 text-xl rounded-2xl" onClick={handleBackspace}>⌫</Button>
        </div>
      </div>
    </div>
  );
}
