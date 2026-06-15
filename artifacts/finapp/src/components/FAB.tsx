import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, X, PenLine, Tag, ScanLine } from 'lucide-react';
import AddTransactionModal from '../pages/AddTransactionModal';
import AddCategoryModal from './AddCategoryModal';

export default function FAB() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showCat, setShowCat] = useState(false);

  if (location.pathname !== '/transactions') return null;

  const toggle = () => setOpen(o => !o);

  const actions = [
    {
      icon: PenLine,
      label: 'Ajouter une transaction',
      onClick: () => { setOpen(false); setShowAdd(true); },
      testId: 'fab-add-transaction',
    },
    {
      icon: Tag,
      label: 'Créer une catégorie',
      onClick: () => { setOpen(false); setShowCat(true); },
      testId: 'fab-add-category',
    },
    {
      icon: ScanLine,
      label: 'Scanner une facture',
      onClick: () => { setOpen(false); setShowAdd(true); },
      testId: 'fab-scan',
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mini menu */}
      <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-2 lg:bottom-8">
        {open && actions.map((action, i) => (
          <div
            key={action.testId}
            className="flex items-center gap-3 animate-zoomIn"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="bg-card/90 backdrop-blur-xl text-foreground text-sm font-medium px-3 py-1.5 rounded-full border border-card-border shadow-lg whitespace-nowrap">
              {action.label}
            </span>
            <button
              onClick={action.onClick}
              className="w-11 h-11 rounded-full bg-card/90 backdrop-blur-xl border border-card-border shadow-lg flex items-center justify-center text-foreground hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
              data-testid={action.testId}
            >
              <action.icon className="h-4 w-4" />
            </button>
          </div>
        ))}

        {/* Main FAB */}
        <button
          onClick={toggle}
          className={`w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 ${open ? 'rotate-45' : ''}`}
          data-testid="fab-main"
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>

      <AddTransactionModal open={showAdd} onClose={() => setShowAdd(false)} />
      <AddCategoryModal open={showCat} onClose={() => setShowCat(false)} />
    </>
  );
}
