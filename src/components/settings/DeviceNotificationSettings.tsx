import { useEffect, useState } from "react";
import { Bell, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disablePush, enablePush, hasInstallPrompt, hasPushSubscription, installed, promptInstall, pushAvailable, pushConfigured } from "@/services/pwa";

export function DeviceNotificationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [canInstall, setCanInstall] = useState(hasInstallPrompt);
  const available = pushAvailable();
  const isInstalled = installed();

  useEffect(() => {
    let active = true;
    void hasPushSubscription().then((result) => { if (active) setEnabled(result); }).catch(() => undefined);
    const update = () => setCanInstall(hasInstallPrompt());
    window.addEventListener("collectipay-install-available", update);
    return () => { active = false; window.removeEventListener("collectipay-install-available", update); };
  }, []);

  const toggle = async () => {
    setPending(true);
    try {
      if (enabled) await disablePush();
      else await enablePush();
      setEnabled(!enabled);
      toast.success(enabled ? "Device notifications turned off." : "Device notifications enabled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t update device notifications.");
    } finally { setPending(false); }
  };

  return (
    <div className="cp-card-native space-y-3 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Bell size={16} aria-hidden /> Device notifications</h3>
      <p className="text-sm text-muted-foreground">Get payment amounts and updates on this device when CollectiPay is closed. Choose the categories above.</p>
      {available && (pushConfigured || enabled) ? (
        <Button type="button" variant="outline" onClick={toggle} disabled={pending}>{pending ? "Updating…" : enabled ? "Turn off on this device" : "Enable on this device"}</Button>
      ) : (
        <p className="text-sm text-muted-foreground">{available ? "Device alerts are awaiting server setup." : "Install CollectiPay on your Home Screen to enable alerts on supported devices."}</p>
      )}
      {!isInstalled && (
        canInstall ? <Button type="button" variant="ghost" className="gap-2" onClick={() => void promptInstall().finally(() => setCanInstall(hasInstallPrompt()))}>
          <Download size={16} aria-hidden /> Install CollectiPay
        </Button> : <p className="text-xs text-muted-foreground">Use your browser’s Install App or Add to Home Screen option.</p>
      )}
    </div>
  );
}
