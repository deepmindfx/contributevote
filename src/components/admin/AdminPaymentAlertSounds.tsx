import { useEffect, useState } from "react";
import { FileAudio, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPaymentSoundOverrides, paymentSoundUrl, setPaymentAlertSound } from "@/services/supabase/paymentAlertSoundService";
import type { PaymentSoundKind, PaymentSoundOverrides } from "@/services/supabase/paymentAlertSoundService";

function SoundSetting({ kind, title, path, onChange }: { kind: PaymentSoundKind; title: string; path: string | null; onChange: (path: string | null) => void }) {
  const [selected, setSelected] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [inputVersion, resetInput] = useState(0);

  const save = async (file: File | null) => {
    setBusy(true);
    try {
      const next = await setPaymentAlertSound(kind, file);
      onChange(next);
      setSelected(undefined);
      resetInput((version) => version + 1);
      toast.success(file ? "Payment sound updated" : "Default payment sound restored");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t save the payment sound. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <section className="min-w-0 space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{path ? "Custom sound" : "Default sound"}</span>
      </div>
      <audio className="w-full" key={path ?? kind} src={paymentSoundUrl(kind, path)} controls preload="none" aria-label={`Preview ${title.toLowerCase()} sound`} />
      <div className="space-y-1.5">
        <Label htmlFor={`payment-sound-${kind}`} className="text-xs">Replacement MP3</Label>
        <Input key={inputVersion} id={`payment-sound-${kind}`} type="file" accept=".mp3,audio/mpeg" disabled={busy}
          onChange={(event) => setSelected(event.target.files?.[0])} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!selected || busy} onClick={() => { if (selected) void save(selected); }} className="gap-2">
          <FileAudio size={15} aria-hidden="true" /> {busy ? "Saving…" : "Save MP3"}
        </Button>
        {path && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void save(null)}>Restore default</Button>}
      </div>
    </section>
  );
}

export function AdminPaymentAlertSounds() {
  const [sounds, setSounds] = useState<PaymentSoundOverrides>();
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void getPaymentSoundOverrides().then(
      (data) => { if (active) setSounds(data); },
      () => { if (active) setError(true); },
    );
    return () => { active = false; };
  }, [reload]);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Volume2 size={19} className="text-primary" /> Payment alert sounds</CardTitle>
        <CardDescription>Preview or replace the in-app sound for incoming payments. Use an MP3 up to 2 MB.</CardDescription>
      </CardHeader>
      <CardContent>
        {sounds ? <div className="grid gap-3 lg:grid-cols-2">
          <SoundSetting kind="wallet" title="Wallet payment" path={sounds.wallet} onChange={(wallet) => setSounds((current) => ({ ...current!, wallet }))} />
          <SoundSetting kind="group" title="Group contribution" path={sounds.group} onChange={(group) => setSounds((current) => ({ ...current!, group }))} />
        </div> : error ? (
          <Button variant="outline" onClick={() => { setError(false); setReload((version) => version + 1); }}>Retry loading sounds</Button>
        ) : <p role="status" className="text-sm text-muted-foreground">Loading payment sounds…</p>}
      </CardContent>
    </Card>
  );
}
