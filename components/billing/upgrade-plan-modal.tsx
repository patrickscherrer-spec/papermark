import { Button } from "@/components/ui/button";

export function UpgradePlanModal({ open, setOpen, children }: any) {
  if (!open && !children) return null;
  if (children) return <>{children}</>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-lg bg-background p-6">
        <h3 className="text-lg font-bold">Upgrade</h3>
        <p className="my-2 text-sm text-muted-foreground">Du nutzt bereits die vollwertige Self-Hosted Instanz.</p>
        <Button onClick={() => setOpen && setOpen(false)}>Schließen</Button>
      </div>
    </div>
  );
}