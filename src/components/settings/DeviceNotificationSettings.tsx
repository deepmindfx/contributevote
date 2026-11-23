import { useEffect, useState } from "react";
import { Bell, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disablePush, enablePush, getPushStatus, hasInstallPrompt, installed, promptInstall, pushAvailable, pushConfigured, sendPushTest } from "@/services/pwa";

export function DeviceNotificationSettings() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getPushStatus>>>(null);
  const [pending, setPending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [canInstall, setCanInstall] = useState(hasInstallPrompt);
  const available = pushAvailable();
  const isInstalled = installed();
  const enabled = Boolean(status?.registered);

  useEffect(() => {
    let active = true;
    const sync = () => void getPushStatus().then((result) => { if (active) setStatus(result); }).catch(() => undefined);
    sync();
    const update = () => setCanInstall(hasInstallPrompt());
    window.addEventListener("collectipay-install-available", update);
    window.addEventListener("focus", sync);
    return () => { active = false; window.removeEventListener("collectipay-install-available", update); window.removeEventListener("focus", sync); };
  }, []);

  const toggle = async (turnOff: boolean) => {
    setPending(true);
    try {
      if (turnOff) await disablePush();
      else await enablePush();
      setStatus(turnOff ? null : await getPushStatus());
      toast.success(turnOff ? "Device notifications turned off." : "Device notifications enabled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t update device notifications.");
    } finally { setPending(false); }
  };

  const test = async () => {
    setTesting(true);
    try {
      await sendPushTest();
      toast.success("Test queued. It should arrive within a minute.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t send the test alert.");
    } finally { setTesting(false); }
  };

  return (
    <div id="device-notifications" className="cp-card-native scroll-mt-20 space-y-3 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Bell size={16} aria-hidden /> Device notifications</h3>
      <p className="text-sm text-muted-foreground">Enable alerts on this device to receive payment updates when CollectiPay is closed. Your browser will ask for permission.</p>
      {available && (pushConfigured || enabled) ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void toggle(enabled)} disabled={pending}>{pending ? "Updating…" : enabled ? "Turn off on this device" : "Enable on this device"}</Button>
          {enabled && <Button type="button" variant="outline" onClick={test} disabled={testing}>{testing ? "Queuing…" : "Send a test alert"}</Button>}
          {status?.last_error && <Button type="button" variant="ghost" onClick={() => void toggle(false)} disabled={pending}>Reconnect</Button>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{available ? "Device alerts are awaiting server setup." : "Install CollectiPay on your Home Screen to enable alerts on supported devices."}</p>
      )}
      {status?.last_error && <p role="status" className="text-xs text-muted-foreground">{status.last_error}</p>}
      {status?.last_delivered_at && !status.last_error && (
        <p className="text-xs text-muted-foreground">Last accepted by your push service {new Date(status.last_delivered_at).toLocaleString()}.</p>
      )}
      {!isInstalled && (
        canInstall ? <Button type="button" variant="ghost" className="gap-2" onClick={() => void promptInstall().finally(() => setCanInstall(hasInstallPrompt()))}>
          <Download size={16} aria-hidden /> Install CollectiPay
        </Button> : <p className="text-xs text-muted-foreground">Use your browser’s Install App or Add to Home Screen option.</p>
      )}
    </div>
  );
}
