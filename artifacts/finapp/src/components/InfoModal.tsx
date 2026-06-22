import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface InfoModalProps {
  title: string;
  description: string;
}

export default function InfoModal({ title, description }: InfoModalProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div 
      className="relative z-50 inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 active:scale-95 transition-all duration-200"
        data-testid="btn-info"
      >
        <Info className="h-4.5 w-4.5" />
      </button>

      {visible && (
        <div className="absolute right-0 top-full mt-2 w-72 p-4 bg-card/95 border border-card-border backdrop-blur-xl rounded-2xl text-xs text-foreground shadow-2xl animate-fadeUp text-left pointer-events-none z-[100]">
          <h4 className="font-semibold text-sm mb-1">{title}</h4>
          <p className="text-muted-foreground leading-relaxed font-normal">{description}</p>
          <div className="absolute bottom-full right-4 border-8 border-transparent border-b-card" />
        </div>
      )}
    </div>
  );
}
