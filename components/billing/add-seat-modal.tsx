import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AddSeatModal({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-lg bg-background p-6">
        <h3 className="text-lg font-bold">Teammitglieder</h3>
        <p className="my-2 text-sm text-muted-foreground">Sitzplatzverwaltung ist im Self-Hosted Modus deaktiviert.</p>
        <Button onClick={() => setOpen(false)}>Schließen</Button>
      </div>
    </div>
  );
}