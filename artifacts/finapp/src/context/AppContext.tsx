import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, Settings } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface AppContextType {
  settings: Settings | undefined;
  updateSettings: (settings: Partial<Settings>) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  isFirstRun: boolean;
  isLoading: boolean;
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [dbLoaded, setDbLoaded] = useState(false);
  const settings = useLiveQuery(async () => {
    const s = await db.settings.get('user');
    setDbLoaded(true);
    return s;
  });
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [primaryColor, setPrimaryColor] = useState('239 84% 67%');
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (settings) {
      setTheme(settings.themeMode || 'dark');
      if (settings.customColors) setPrimaryColor(settings.customColors);
      if (settings.customColors) {
        document.documentElement.style.setProperty('--primary', settings.customColors);
        document.documentElement.style.setProperty('--ring', settings.customColors);
      }
      // Auto-lock if PIN is set and app is starting fresh
      if (settings.pinCode) setIsLocked(true);
    }
  }, [settings?.id]); // only fire when settings first loads

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && settings?.pinCode) {
        setIsLocked(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [settings?.pinCode, setIsLocked]);

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const updateSettings = async (newSettings: Partial<Settings>) => {
    const existing = await db.settings.get('user');
    if (existing) {
      await db.settings.update('user', newSettings);
    } else {
      await db.settings.put({ id: 'user', username: '', pinCode: '', defaultCurrency: 'EUR', themeMode: 'dark', customColors: '239 84% 67%', aiPreferences: '', ...newSettings });
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    updateSettings({ themeMode: newTheme });
  };

  return (
    <AppContext.Provider value={{
      settings,
      updateSettings,
      theme,
      toggleTheme,
      primaryColor,
      setPrimaryColor,
      isFirstRun: dbLoaded && !settings,
      isLoading: !dbLoaded,
      isLocked,
      setIsLocked
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
