import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface InfoModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
}

export default function InfoModal({ open, onClose, title, description }: InfoModalProps) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="animate-zoomIn sm:max-w-sm bg-card/95 backdrop-blur-xl border-card-border">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm mt-2">{description}</p>
        <Button onClick={onClose} className="mt-4 w-full" data-testid="btn-info-close">Compris !</Button>
      </DialogContent>
    </Dialog>
  );
}
