import React, { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  RefreshCw,
  SendHorizontal,
  Server,
  ShieldCheck,
  Sparkles,
  Wifi,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import BrandLoader from "@/components/ui/BrandLoader";
import {
  AdminComplianceService,
  type PaymentGatewaySettings,
} from "@/services/supabase/adminComplianceService";
import { cn } from "@/lib/utils";

const DEFAULT_WEBHOOK_URL =
  "https://sivvjwffekhfabgxhbcd.supabase.co/functions/v1/webhook-contribution";

interface AdminPaymentSettingsProps {
  onSettingsSaved?: () => void;
}

export const AdminPaymentSettings: React.FC<AdminPaymentSettingsProps> = ({
  onSettingsSaved,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingRelay, setTestingRelay] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);

  const [savedMeta, setSavedMeta] = useState<PaymentGatewaySettings | null>(null);
  const [mode, setMode] = useState<"live" | "test">("live");
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [encryptionKey, setEncryptionKey] = useState("");
  const [webhookHash, setWebhookHash] = useState("");
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_WEBHOOK_URL);
  const [staticIpProxyUrl, setStaticIpProxyUrl] = useState("");
  const [staticIpProxySecret, setStaticIpProxySecret] = useState("");
  const [staticIpAddress, setStaticIpAddress] = useState("2.25.15.1");
  const [transfersEnabled, setTransfersEnabled] = useState(true);

  const [showSecret, setShowSecret] = useState(false);
  const [showEncryption, setShowEncryption] = useState(false);
  const [showHash, setShowHash] = useState(false);
  const [showProxySecret, setShowProxySecret] = useState(false);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    meta?: string;
  } | null>(null);

  const [relayTestResult, setRelayTestResult] = useState<{
    success: boolean;
    message: string;
    meta?: string;
  } | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AdminComplianceService.getPaymentSettings();
      if (res?.success && res.data) {
        setSavedMeta(res.data);
        setMode(res.data.flutterwave_mode === "test" ? "test" : "live");
        setPublicKey(res.data.flutterwave_public_key || "");
        setWebhookUrl(res.data.webhook_url || DEFAULT_WEBHOOK_URL);
        setStaticIpProxyUrl(res.data.static_ip_proxy_url || "");
        setStaticIpAddress(res.data.static_ip_address || "2.25.15.1");
        setTransfersEnabled(res.data.transfers_enabled !== false);
        setSecretKey("");
        setEncryptionKey("");
        setWebhookHash("");
        setStaticIpProxySecret("");
      } else if (res?.error) {
        toast.error(res.error);
      }
    } catch (err: any) {
      console.error("Failed to load payment settings:", err);
      toast.error(err?.message || "Failed to load Flutterwave settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleCopyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl || DEFAULT_WEBHOOK_URL);
      setCopiedWebhook(true);
      toast.success("Webhook URL copied to clipboard");
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch {
      toast.error("Could not copy webhook URL");
    }
  };

  const handleCopyStaticIp = async () => {
    try {
      await navigator.clipboard.writeText(staticIpAddress || "2.25.15.1");
      setCopiedIp(true);
      toast.success(`Static IP ${staticIpAddress || "2.25.15.1"} copied!`);
      setTimeout(() => setCopiedIp(false), 2000);
    } catch {
      toast.error("Could not copy Static IP");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      const res = await AdminComplianceService.savePaymentSettings({
        mode,
        publicKey: publicKey.trim(),
        secretKey: secretKey.trim() || undefined,
        encryptionKey: encryptionKey.trim() || undefined,
        webhookHash: webhookHash.trim() || undefined,
        webhookUrl: webhookUrl.trim() || DEFAULT_WEBHOOK_URL,
        staticIpProxyUrl: staticIpProxyUrl.trim(),
        staticIpProxySecret: staticIpProxySecret.trim() || undefined,
        staticIpAddress: staticIpAddress.trim() || "2.25.15.1",
        transfersEnabled,
      });

      if (!res?.success || !res.data) {
        toast.error(res?.error || "Failed to save Flutterwave settings");
        return;
      }

      setSavedMeta(res.data);
      setSecretKey("");
      setEncryptionKey("");
      setWebhookHash("");
      setStaticIpProxySecret("");
      toast.success("Flutterwave gateway & Static-IP Relay settings saved!");
      onSettingsSaved?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save payment settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestRelay = async () => {
    setTestingRelay(true);
    setRelayTestResult(null);
    try {
      const res = await AdminComplianceService.testStaticIpRelay();
      if (res.success) {
        setRelayTestResult({
          success: true,
          message: `Static-IP Relay Online · Egress IP ${res.staticIp || staticIpAddress} (${res.latencyMs}ms)`,
          meta: `Endpoint: ${res.url || staticIpProxyUrl}`,
        });
        toast.success("Static-IP Relay is online and ready!");
      } else {
        setRelayTestResult({
          success: false,
          message: res.error || "Static-IP Relay did not respond",
          meta: `Checked in ${res.latencyMs}ms`,
        });
        toast.error(res.error || "Static-IP Relay check failed");
      }
    } finally {
      setTestingRelay(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await AdminComplianceService.testFlutterwaveConnection();
      if (res.success) {
        setTestResult({
          success: true,
          message: `Connected to Flutterwave (${res.bankCount ?? 0} Nigerian banks loaded in ${res.latencyMs}ms)`,
          meta: `Mode: ${(res.mode || mode).toUpperCase()} · Routing: ${
            res.routedViaStaticIp
              ? `Static-IP Relay (${res.staticIpAddress || staticIpAddress})`
              : "Direct Edge Function"
          }`,
        });
        toast.success("Flutterwave API connection verified!");
      } else {
        setTestResult({
          success: false,
          message: res.error || "Flutterwave rejected the configured secret key",
          meta: `Checked in ${res.latencyMs}ms`,
        });
        toast.error(res.error || "Connection test failed");
      }
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="cp-card-native p-10">
        <BrandLoader
          variant="page"
          message="Loading Flutterwave Settings"
          submessage="Fetching encrypted gateway & Static-IP Relay status…"
        />
      </div>
    );
  }

  const updatedLabel =
    savedMeta?.updated_at && isValid(new Date(savedMeta.updated_at))
      ? format(new Date(savedMeta.updated_at), "MMM d, yyyy · h:mm a")
      : "Not saved yet (using server secrets)";

  return (
    <div className="space-y-5">
      {saving && (
        <BrandLoader
          variant="overlay"
          badge="Payment Gateway"
          message="Saving Flutterwave & Static-IP settings"
          submessage="Applying live credentials across all Edge Functions & payout relay…"
        />
      )}

      {/* Top Status & Quick Test Strip */}
      <div className="cp-card-native flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                Flutterwave Gateway &amp; Static-IP Payout Relay
              </h2>
              <Badge
                variant={mode === "live" ? "default" : "secondary"}
                className="text-[10px] font-bold uppercase tracking-wider"
              >
                {mode === "live" ? "Live Mode" : "Test Sandbox"}
              </Badge>
              {savedMeta?.static_ip_proxy_url && savedMeta?.has_proxy_secret && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <Server className="h-3 w-3" />
                  Static IP {savedMeta.static_ip_address || "2.25.15.1"} Active
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage Flutterwave API keys, Webhook Secret Hash, and your Ubuntu Static-IP Payout Relay so live Send Money bank transfers pass Flutterwave IP whitelisting.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Last updated: <span className="font-medium text-foreground">{updatedLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestRelay}
            disabled={testingRelay || saving}
            className="h-10 gap-2 rounded-xl font-semibold"
          >
            {testingRelay ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Server className="h-4 w-4 text-primary" />
            )}
            Test Relay
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || saving}
            className="h-10 gap-2 rounded-xl font-semibold"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="h-4 w-4 text-primary" />
            )}
            Test Flutterwave
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void loadSettings()}
            disabled={loading || saving}
            className="h-10 w-10 rounded-xl"
            aria-label="Reload gateway settings"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Test Result Banners */}
      {relayTestResult && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-2xl border p-4 text-sm",
            relayTestResult.success
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
              : "border-destructive/35 bg-destructive/10 text-destructive"
          )}
        >
          {relayTestResult.success ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="font-bold">{relayTestResult.message}</p>
            {relayTestResult.meta && (
              <p className="mt-0.5 text-xs opacity-85">{relayTestResult.meta}</p>
            )}
          </div>
        </div>
      )}

      {testResult && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-2xl border p-4 text-sm",
            testResult.success
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
              : "border-destructive/35 bg-destructive/10 text-destructive"
          )}
        >
          {testResult.success ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="font-bold">{testResult.message}</p>
            {testResult.meta && (
              <p className="mt-0.5 text-xs opacity-85">{testResult.meta}</p>
            )}
          </div>
        </div>
      )}

      {/* Main Two-Column Setup Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Credentials Form */}
        <form onSubmit={handleSave} className="cp-card-native space-y-5 p-5 lg:col-span-3">
          {/* Environment Mode Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              1. Gateway Environment &amp; Payouts
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  {
                    id: "live",
                    title: "Live Production",
                    desc: "Real Naira transfers & payouts",
                  },
                  {
                    id: "test",
                    title: "Test / Sandbox",
                    desc: "Flutterwave test keys for QA",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={cn(
                    "flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all",
                    mode === opt.id
                      ? "border-primary bg-accent/60 shadow-sm ring-1 ring-primary/25"
                      : "border-border bg-card hover:bg-muted/40"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-sm font-bold text-foreground">{opt.title}</span>
                    {mode === opt.id && (
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 text-[11px] text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/25 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <SendHorizontal className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Enable Outbound Bank Transfers (Send Money)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Routes user payouts through your whitelisted Static-IP VPS Relay.
                  </p>
                </div>
              </div>
              <Switch checked={transfersEnabled} onCheckedChange={setTransfersEnabled} />
            </div>
          </div>

          {/* Public Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="flw-public-key" className="text-xs font-semibold">
                Flutterwave Public Key
              </Label>
              <span className="font-mono text-[10px] text-muted-foreground">
                {mode === "live" ? "FLWPUBK-..." : "FLWPUBK_TEST-..."}
              </span>
            </div>
            <Input
              id="flw-public-key"
              type="text"
              placeholder={
                mode === "live"
                  ? "Paste live Flutterwave Public Key (starts with FLWPUBK-)"
                  : "Paste test Flutterwave Public Key (starts with FLWPUBK_TEST-)"
              }
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              className="h-11 rounded-xl font-mono text-xs"
              autoComplete="off"
            />
          </div>

          {/* Secret Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="flw-secret-key" className="text-xs font-semibold">
                Flutterwave Secret Key
              </Label>
              {savedMeta?.has_secret_key ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <Lock className="h-2.5 w-2.5" />
                  Saved: {savedMeta.secret_key_masked}
                </span>
              ) : (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {mode === "live" ? "FLWSECK-..." : "FLWSECK_TEST-..."}
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="flw-secret-key"
                type={showSecret ? "text" : "password"}
                placeholder={
                  savedMeta?.has_secret_key
                    ? "Leave blank to keep existing secret key, or paste new key…"
                    : mode === "live"
                    ? "Paste live Flutterwave Secret Key"
                    : "Paste test Flutterwave Secret Key"
                }
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="h-11 rounded-xl pr-11 font-mono text-xs"
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute inset-y-0 right-0 h-11 w-11 text-muted-foreground"
                aria-label={showSecret ? "Hide secret key" : "Show secret key"}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Encryption Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="flw-encryption-key" className="text-xs font-semibold">
                Flutterwave Encryption Key
              </Label>
              {savedMeta?.has_encryption_key && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <Lock className="h-2.5 w-2.5" />
                  Saved: {savedMeta.encryption_key_masked}
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="flw-encryption-key"
                type={showEncryption ? "text" : "password"}
                placeholder={
                  savedMeta?.has_encryption_key
                    ? "Leave blank to keep existing encryption key…"
                    : "Paste Flutterwave Encryption Key"
                }
                value={encryptionKey}
                onChange={(e) => setEncryptionKey(e.target.value)}
                className="h-11 rounded-xl pr-11 font-mono text-xs"
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowEncryption((v) => !v)}
                className="absolute inset-y-0 right-0 h-11 w-11 text-muted-foreground"
                aria-label={showEncryption ? "Hide encryption key" : "Show encryption key"}
              >
                {showEncryption ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Webhook Secret Hash */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="flw-webhook-hash" className="text-xs font-semibold">
                Webhook Secret Hash (<span className="font-mono">verif-hash</span>)
              </Label>
              {savedMeta?.has_webhook_hash && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <Lock className="h-2.5 w-2.5" />
                  Saved: {savedMeta.webhook_hash_masked}
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="flw-webhook-hash"
                type={showHash ? "text" : "password"}
                placeholder={
                  savedMeta?.has_webhook_hash
                    ? "Leave blank to keep existing webhook secret hash…"
                    : "Paste the exact Secret Hash configured in Flutterwave Webhooks"
                }
                value={webhookHash}
                onChange={(e) => setWebhookHash(e.target.value)}
                className="h-11 rounded-xl pr-11 font-mono text-xs"
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowHash((v) => !v)}
                className="absolute inset-y-0 right-0 h-11 w-11 text-muted-foreground"
                aria-label={showHash ? "Hide webhook hash" : "Show webhook hash"}
              >
                {showHash ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Static-IP Relay Advanced Override */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              2. Static-IP Payout Relay (Ubuntu VPS)
            </Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="flw-relay-url" className="text-xs font-semibold">
                  Relay Endpoint URL
                </Label>
                <Input
                  id="flw-relay-url"
                  type="text"
                  placeholder="https://2-25-15-1.sslip.io"
                  value={staticIpProxyUrl}
                  onChange={(e) => setStaticIpProxyUrl(e.target.value)}
                  className="h-11 rounded-xl font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <Label htmlFor="flw-relay-secret" className="text-xs font-semibold">
                    Relay Auth Secret
                  </Label>
                  {savedMeta?.has_proxy_secret && (
                    <span className="font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Saved
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="flw-relay-secret"
                    type={showProxySecret ? "text" : "password"}
                    placeholder={
                      savedMeta?.has_proxy_secret
                        ? "Leave blank to keep relay secret…"
                        : "Relay X-Relay-Secret token"
                    }
                    value={staticIpProxySecret}
                    onChange={(e) => setStaticIpProxySecret(e.target.value)}
                    className="h-11 rounded-xl pr-11 font-mono text-xs"
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowProxySecret((v) => !v)}
                    className="absolute inset-y-0 right-0 h-11 w-11 text-muted-foreground"
                  >
                    {showProxySecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Secrets are strictly admin-only &amp; never sent back to browsers.
            </p>
            <Button
              type="submit"
              disabled={saving}
              className="h-11 gap-2 rounded-xl px-6 font-bold shadow-sm"
            >
              <Sparkles className="h-4 w-4" />
              {saving ? "Saving…" : "Save Gateway Settings"}
            </Button>
          </div>
        </form>

        {/* Right Column: Static IP Whitelist Card + Webhook URL + Checklist */}
        <div className="space-y-4 lg:col-span-2">
          {/* Static IP Card for Flutterwave Whitelist */}
          <div className="cp-card-native space-y-3 border-primary/30 bg-gradient-to-br from-emerald-500/[0.06] to-card p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Server className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Static IP for Flutterwave Whitelist
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Add this IP in Flutterwave → Settings → Whitelisted IP Addresses
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={staticIpAddress}
                onChange={(e) => setStaticIpAddress(e.target.value)}
                className="h-11 rounded-xl bg-card font-mono text-base font-extrabold tracking-wider"
                aria-label="Static IP Address"
              />
              <Button
                type="button"
                onClick={handleCopyStaticIp}
                className="h-11 shrink-0 gap-1.5 rounded-xl px-4 font-bold"
              >
                {copiedIp ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedIp ? "Copied" : "Copy IP"}
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              All outbound <strong>Send Money</strong> bank transfers are routed through your Ubuntu VPS at{" "}
              <strong className="font-mono text-foreground">{staticIpAddress || "2.25.15.1"}</strong>{" "}
              so Flutterwave approves live payouts reliably.
            </p>
          </div>

          <div className="cp-card-native space-y-3 p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-primary">
                <Link2 className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground">Live Webhook URL</h3>
                <p className="text-[11px] text-muted-foreground">
                  Paste this into Flutterwave Dashboard → Settings → Webhooks
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="h-11 rounded-xl bg-muted/40 font-mono text-[11px]"
                aria-label="Flutterwave Webhook URL"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyWebhookUrl}
                className="h-10 w-full gap-2 rounded-xl font-semibold"
              >
                {copiedWebhook ? (
                  <>
                    <Check className="h-4 w-4 text-primary" />
                    Copied Webhook URL
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Webhook URL
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="cp-card-native space-y-3 p-5">
            <h3 className="text-sm font-bold text-foreground">
              Flutterwave Go-Live Checklist
            </h3>
            <ol className="space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                  1
                </span>
                <span>
                  Paste your Flutterwave <strong className="text-foreground">Public, Secret &amp; Encryption Keys</strong> on the left and click Save.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                  2
                </span>
                <span>
                  In Flutterwave → <strong className="text-foreground">Settings → Whitelisted IP Addresses</strong>, add{" "}
                  <strong className="font-mono text-foreground">{staticIpAddress || "2.25.15.1"}</strong> to unlock live Send Money transfers.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                  3
                </span>
                <span>
                  In Flutterwave → <strong className="text-foreground">Settings → Webhooks</strong>, paste the Webhook URL &amp; Secret Hash above, then press <strong className="text-foreground">Test Flutterwave</strong>.
                </span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
