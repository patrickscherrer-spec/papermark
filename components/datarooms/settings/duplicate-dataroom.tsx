import React from "react";
import { Button } from "@/components/ui/button";

export function DuplicateDataroom() {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold">Dataroom duplizieren</h3>
      <p className="my-2 text-sm text-muted-foreground">
        Diese Funktion ist in dieser Instanz deaktiviert.
      </p>
      <Button disabled>Duplizieren</Button>
    </div>
  );
}