import { RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";

export function SessionRecovery() {
  const { retrySession, logout } = useSupabaseUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-5 py-12">
      <section className="w-full space-y-4 rounded-3xl border bg-card p-6 shadow-sm" aria-labelledby="session-heading">
        <span className="grid size-11 place-items-center rounded-2xl bg-accent text-primary">
          <ShieldAlert size={21} aria-hidden="true" />
        </span>
        <div>
          <h1 id="session-heading" className="text-xl font-semibold tracking-tight">Reconnect to CollectiPay</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">We couldn’t load your account. Try again to continue where you left off.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" onClick={() => void retrySession()}><RefreshCw size={15} aria-hidden="true" /> Try again</Button>
          <Button variant="ghost" onClick={() => void logout()}>Sign out</Button>
        </div>
      </section>
    </main>
  );
}
