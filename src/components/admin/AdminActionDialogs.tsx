import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  Check,
  CheckCircle2,
  Flame,
  Gavel,
  Lock,
  PauseCircle,
  Pin,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  ORGANIZER_BADGE_PRESETS,
  PENALTY_TYPE_OPTIONS,
  SPOTLIGHT_LABEL_PRESETS,
  type AmlAlertRecord,
  type AmlAlertSeverity,
  type AmlAlertStatus,
  type PenaltyType,
} from "@/services/supabase/adminComplianceService";
import { cn } from "@/lib/utils";
import { AdminEntityPicker, type AdminEntity } from "./AdminEntityPicker";

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000, 50000];

/* ============================================================================
 * 1. WALLET DEBIT DIALOG
 * ========================================================================== */
interface WalletAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any | null;
  pending: boolean;
  onConfirm: (payload: {
    userId: string;
    amount: number;
    reason: string;
    caseReference: string;
    pin: string;
  }) => Promise<void>;
}

export const WalletAdjustDialog: React.FC<WalletAdjustDialogProps> = ({
  open,
  onOpenChange,
  user,
  pending,
  onConfirm,
}) => {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [caseReference, setCaseReference] = useState("");
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (open) {
      setAmount("");
      setReason("");
      setCaseReference("");
      setPin("");
    }
  }, [open, user?.id]);

  const numericAmount = Number(amount);
  const currentBalance = Number(user?.wallet_balance || 0);
  const insufficientForDebit = numericAmount > currentBalance;
  const canSubmit = Number.isFinite(numericAmount) && numericAmount > 0 && !insufficientForDebit &&
    /^[a-z0-9][a-z0-9._-]{5,79}$/i.test(caseReference.trim()) && reason.trim().length >= 8 && /^\d{4}$/.test(pin);

  const submit = async () => {
    if (!user || !canSubmit || pending) return;
    await onConfirm({
      userId: user.id,
      amount: numericAmount,
      reason: reason.trim(),
      caseReference: caseReference.trim(),
      pin,
    });
    setPin("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Request a wallet debit</DialogTitle>
          <DialogDescription>
            {user?.name || user?.email} · Current balance:{" "}
            <strong className="text-foreground tabular-nums">
              ₦{currentBalance.toLocaleString("en-NG")}
            </strong>
          </DialogDescription>
          <p className="text-sm text-muted-foreground">A second administrator must approve this request before the balance changes.</p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="admin-wallet-amount">Amount (₦)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-primary">
                ₦
              </span>
              <Input
                id="admin-wallet-amount"
                type="number"
                inputMode="decimal"
                placeholder="10000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 rounded-xl pl-8 font-semibold tabular-nums"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(String(val))}
                  className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-primary"
                >
                  ₦{(val / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
            {insufficientForDebit && (
              <p className="text-xs font-medium text-destructive">
                Debit exceeds user’s available balance (₦{currentBalance.toLocaleString("en-NG")}).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-wallet-reason">Audit reason</Label>
            <Input
              id="admin-wallet-reason"
              placeholder="e.g. Duplicate credit reversal"
              value={reason}
              maxLength={400}
              onChange={(e) => setReason(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-wallet-case">Case reference</Label>
            <Input id="admin-wallet-case" value={caseReference} maxLength={80} onChange={(e) => setCaseReference(e.target.value)} placeholder="e.g. CP-4821" />
            <p className="text-xs text-muted-foreground">Use the same reference when retrying this request.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-wallet-pin">Your transaction PIN</Label>
            <Input id="admin-wallet-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4}
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={pending || !canSubmit}
            className="rounded-xl"
          >
            {pending ? "Submitting…" : "Request approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================================
 * 2. ISSUE PENALTY DIALOG
 * ========================================================================== */
interface IssuePenaltyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetUser?: AdminEntity | null;
  presetAmlAlertId?: string | null;
  pending: boolean;
  onConfirm: (payload: {
    userId: string;
    amount: number;
    penaltyType: PenaltyType;
    reason: string;
    groupId?: string | null;
    amlAlertId?: string | null;
  }) => Promise<void>;
}

export const IssuePenaltyDialog: React.FC<IssuePenaltyDialogProps> = ({
  open,
  onOpenChange,
  presetUser,
  presetAmlAlertId,
  pending,
  onConfirm,
}) => {
  const [selectedUser, setSelectedUser] = useState<AdminEntity | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<AdminEntity | null>(null);
  const [penaltyType, setPenaltyType] = useState<PenaltyType>("policy_violation");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedUser(null);
    setSelectedGroup(null);
    setPenaltyType(presetAmlAlertId ? "aml_hold" : "policy_violation");
    setAmount("");
    setReason("");
  }, [open, presetUser?.id, presetAmlAlertId]);

  const target = presetUser || selectedUser;
  const validAmount = amount === "" || (/^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) <= 9_999_999_999_999.99);
  const canSubmit = Boolean(target && validAmount && reason.trim() && !pending);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-h-[90dvh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Record a compliance notice</DialogTitle>
          <DialogDescription>
            Notify the customer and document the issue in the audit log. Their wallet balance stays the same.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (!target || !canSubmit) return;
          void onConfirm({
            userId: target.id,
            amount: Number(amount || 0),
            penaltyType,
            reason: reason.trim(),
            groupId: selectedGroup?.id,
            amlAlertId: presetAmlAlertId,
          });
        }}>
          {presetUser ? (
            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Account</p>
              <p className="break-words text-sm font-semibold">{presetUser.name}</p>
              {presetUser.description && <p className="break-all text-xs text-muted-foreground">{presetUser.description}</p>}
            </div>
          ) : open && (
            <AdminEntityPicker scope="account" label="Account" value={selectedUser} onChange={setSelectedUser} disabled={pending} />
          )}

          <div className="space-y-2">
            <Label htmlFor="notice-category">Category</Label>
            <select id="notice-category" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              value={penaltyType} onChange={event => setPenaltyType(event.target.value as PenaltyType)} disabled={pending}>
              {PENALTY_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          {open && !presetAmlAlertId && (
            <AdminEntityPicker scope="group" label="Related group (optional)" value={selectedGroup} onChange={setSelectedGroup} disabled={pending} />
          )}

          <div className="space-y-2">
            <Label htmlFor="notice-reference-amount">Reference amount (₦, optional)</Label>
            <Input id="notice-reference-amount" inputMode="decimal" value={amount} maxLength={16}
              onChange={event => setAmount(event.target.value)} disabled={pending} />
            <p className="text-xs text-muted-foreground">For recording the amount involved in the incident.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notice-reason">Message to the customer</Label>
            <Textarea id="notice-reason" rows={3} value={reason} maxLength={1000} required
              onChange={event => setReason(event.target.value)} disabled={pending} />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit}>{pending ? "Recording…" : "Record notice"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================================
 * 3. GROUP GOVERNANCE CONTROL DIALOG
 * ========================================================================== */
interface GroupControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: any | null;
  pending: boolean;
  onConfirm: (payload: {
    groupId: string;
    status: "active" | "paused" | "frozen" | "completed" | "cancelled";
    archived: boolean;
    reason: string;
  }) => Promise<void>;
}

export const GroupControlDialog: React.FC<GroupControlDialogProps> = ({
  open,
  onOpenChange,
  group,
  pending,
  onConfirm,
}) => {
  const [status, setStatus] = useState<"active" | "paused" | "frozen" | "completed" | "cancelled">("active");
  const [archived, setArchived] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open && group) {
      setStatus((group.status || "active") as any);
      setArchived(Boolean(group.archived));
      setReason("");
    }
  }, [open, group]);

  const STATUS_TILES = [
    { value: "active" as const, label: "Active", desc: "Normal pool operation", icon: PlayCircle },
    { value: "paused" as const, label: "Paused", desc: "Temporarily halted", icon: PauseCircle },
    { value: "frozen" as const, label: "Frozen (Compliance)", desc: "Locked under review", icon: Snowflake },
    { value: "completed" as const, label: "Completed", desc: "Goal finalized", icon: CheckCircle2 },
    { value: "cancelled" as const, label: "Cancelled", desc: "Terminated pool", icon: XCircle },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Manage Group Governance</DialogTitle>
          <DialogDescription>
            {group?.name} · ₦{Number(group?.current_amount || 0).toLocaleString()} pooled
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STATUS_TILES.map((opt) => {
              const Icon = opt.icon;
              const selected = status === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-selected={selected}
                  onClick={() => setStatus(opt.value)}
                  className="cp-tile-option flex items-center gap-2.5 p-3 text-left"
                >
                  <Icon className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-foreground">{opt.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{opt.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-3.5">
            <div className="flex items-center gap-2.5">
              <Archive className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Archive group</p>
                <p className="text-xs text-muted-foreground">Hide from active member dashboards</p>
              </div>
            </div>
            <Switch checked={archived} onCheckedChange={setArchived} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-control-reason">Admin compliance note</Label>
            <Textarea
              id="group-control-reason"
              rows={2}
              placeholder="Reason sent to group creator and recorded in audit trail..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={() =>
              group &&
              onConfirm({
                groupId: group.id,
                status,
                archived,
                reason: reason.trim(),
              })
            }
            disabled={pending}
            className="rounded-xl"
          >
            {pending ? "Saving…" : "Apply group changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================================
 * 4. AML ALERT REVIEW & ACTION DIALOG
 * ========================================================================== */
interface AmlReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: AmlAlertRecord | null;
  pending: boolean;
  onUpdateStatus: (alertId: string, status: AmlAlertStatus, note: string) => Promise<void>;
  onFreezeUser: (userId: string, reason: string) => Promise<void>;
  onOpenPenaltyForAlert: (alert: AmlAlertRecord) => void;
}

export const AmlReviewDialog: React.FC<AmlReviewDialogProps> = ({
  open,
  onOpenChange,
  alert,
  pending,
  onUpdateStatus,
  onFreezeUser,
  onOpenPenaltyForAlert,
}) => {
  const [status, setStatus] = useState<AmlAlertStatus>("investigating");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open && alert) {
      setStatus(alert.status === "open" ? "investigating" : alert.status);
      setNote(alert.resolution_note || "");
    }
  }, [open, alert]);

  if (!alert) return null;

  const STATUS_OPTS: { value: AmlAlertStatus; label: string }[] = [
    { value: "open", label: "Open" },
    { value: "investigating", label: "Investigating" },
    { value: "escalated", label: "Escalated (STR)" },
    { value: "resolved", label: "Resolved" },
    { value: "dismissed", label: "Dismissed (False Positive)" },
  ];

  const evidenceEntries = Object.entries(alert.evidence || {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-h-[90dvh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                alert.severity === "critical" || alert.severity === "high"
                  ? "destructive"
                  : "secondary"
              }
              className="uppercase"
            >
              {alert.severity} · Score {alert.risk_score}/100
            </Badge>
            <Badge variant="outline" className="capitalize">
              {alert.alert_type.replace(/_/g, " ")}
            </Badge>
          </div>
          <DialogTitle className="mt-1">{alert.title}</DialogTitle>
          <DialogDescription>{alert.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Subject Summary */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/35 p-3.5 text-xs">
            <div>
              <span className="text-muted-foreground">Account</span>
              <p className="mt-0.5 font-bold text-foreground">
                {alert.user_profile?.name || alert.user_profile?.email || "Unknown user"}
              </p>
              <p className="text-muted-foreground">{alert.user_profile?.email}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Flagged Exposure</span>
              <p className="mt-0.5 text-base font-extrabold text-foreground tabular-nums">
                ₦{Number(alert.amount || 0).toLocaleString("en-NG")}
              </p>
              <p className="text-muted-foreground">
                Status: <strong className="capitalize text-foreground">{alert.user_profile?.status || "active"}</strong> ·{" "}
                {alert.user_profile?.has_bvn ? "BVN on file" : "No BVN"}
              </p>
            </div>
          </div>

          {/* Evidence Metadata */}
          {evidenceEntries.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Detection Evidence
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 text-xs">
                {evidenceEntries.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <span className="block text-[10px] uppercase text-muted-foreground">
                      {k.replace(/_/g, " ")}
                    </span>
                    <span className="block truncate font-mono font-semibold text-foreground">
                      {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Direct Compliance Enforcement Shortcuts */}
          {alert.user_id && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
              <span className="w-full text-[11px] font-bold uppercase tracking-wider text-destructive">
                Rapid Enforcement Actions
              </span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending || alert.user_profile?.status === "frozen"}
                onClick={() =>
                  onFreezeUser(alert.user_id!, `AML Alert: ${alert.title}`)
                }
                className="h-9 gap-1.5 rounded-xl text-xs"
              >
                <Lock className="h-3.5 w-3.5" />
                {alert.user_profile?.status === "frozen" ? "Account Frozen" : "Freeze User Account"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  onOpenChange(false);
                  onOpenPenaltyForAlert(alert);
                }}
                className="h-9 gap-1.5 rounded-xl text-xs"
              >
                <Gavel className="h-3.5 w-3.5" />
                Record compliance notice
              </Button>
            </div>
          )}

          {/* Workflow Status Selector */}
          <div className="space-y-2">
            <Label>Case disposition</Label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                    status === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-accent"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aml-note">Compliance officer notes</Label>
            <Textarea
              id="aml-note"
              rows={3}
              placeholder="Document source-of-funds review, STR escalation ref, or dismissal rationale..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Close
          </Button>
          <Button
            onClick={() => onUpdateStatus(alert.id, status, note)}
            disabled={pending}
            className="rounded-xl"
          >
            {pending ? "Updating…" : "Save case update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================================
 * 5. MANUAL AML FLAG DIALOG
 * ========================================================================== */
interface ManualAmlFlagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetUser?: AdminEntity | null;
  pending: boolean;
  onConfirm: (payload: {
    userId: string;
    title: string;
    description: string;
    severity: AmlAlertSeverity;
    riskScore: number;
    amount: number;
  }) => Promise<void>;
}

export const ManualAmlFlagDialog: React.FC<ManualAmlFlagDialogProps> = ({
  open,
  onOpenChange,
  presetUser,
  pending,
  onConfirm,
}) => {
  const [selectedUser, setSelectedUser] = useState<AdminEntity | null>(null);
  const userId = (presetUser || selectedUser)?.id;
  const [severity, setSeverity] = useState<AmlAlertSeverity>("high");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedUser(null);
      setSeverity("high");
      setAmount("");
      setTitle("");
      setDescription("");
    }
  }, [open, presetUser?.id]);

  const riskMap: Record<AmlAlertSeverity, number> = {
    low: 35,
    medium: 60,
    high: 82,
    critical: 95,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-h-[90dvh] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Create Manual AML Alert
          </DialogTitle>
          <DialogDescription>
            Flag an account for enhanced due diligence or suspicious activity review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {presetUser ? (
            <p className="break-words rounded-xl border bg-muted/40 p-3 text-sm font-semibold">{presetUser.name}</p>
          ) : open && (
            <AdminEntityPicker scope="account" label="Account to flag" value={selectedUser} onChange={setSelectedUser} disabled={pending} />
          )}

          <div className="space-y-2">
            <Label>Severity level</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {(["low", "medium", "high", "critical"] as AmlAlertSeverity[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSeverity(lvl)}
                  className={cn(
                    "rounded-xl border py-2 text-xs font-bold capitalize transition-all",
                    severity === lvl
                      ? lvl === "critical" || lvl === "high"
                        ? "border-destructive bg-destructive text-destructive-foreground"
                        : "border-primary bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-accent"
                  )}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-aml-title">Alert title</Label>
            <Input
              id="manual-aml-title"
              placeholder="e.g. Third-party mule deposits reported"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-aml-amount">Related exposure (₦) · Optional</Label>
            <Input
              id="manual-aml-amount"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 rounded-xl tabular-nums"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-aml-desc">Investigation summary</Label>
            <Textarea
              id="manual-aml-desc"
              rows={3}
              placeholder="Describe the suspicious pattern, linked pools, or complaint..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button
            disabled={pending || !userId || !title.trim() || !description.trim()}
            onClick={() =>
              onConfirm({
                userId: userId!,
                title: title.trim(),
                description: description.trim(),
                severity,
                riskScore: riskMap[severity],
                amount: Number(amount) || 0,
              })
            }
            className="rounded-xl"
          >
            {pending ? "Creating…" : "Create AML alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================================
 * 6. GROUP VERIFIED CROWDFUNDER & SPOTLIGHT ("MOST NEEDED" / PUSH TO TOP) DIALOG
 * ========================================================================== */
interface GroupSpotlightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: any | null;
  pending: boolean;
  onConfirm: (payload: {
    groupId: string;
    isVerified: boolean;
    isPinned: boolean;
    spotlightLabel: string;
    featuredPriority: number;
    note: string;
  }) => Promise<void>;
}

const PRIORITY_TIERS = [
  { value: 100, label: "#1 Top Slot", desc: "Highest priority on Discover" },
  { value: 50, label: "High Priority", desc: "Near the very top" },
  { value: 10, label: "Standard Pin", desc: "Above regular listings" },
];

export const GroupSpotlightDialog: React.FC<GroupSpotlightDialogProps> = ({
  open,
  onOpenChange,
  group,
  pending,
  onConfirm,
}) => {
  const [isVerified, setIsVerified] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [spotlightLabel, setSpotlightLabel] = useState("");
  const [priority, setPriority] = useState(50);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open && group) {
      setIsVerified(Boolean(group.is_verified));
      setIsPinned(Boolean(group.is_pinned));
      setSpotlightLabel(group.spotlight_label || "");
      setPriority(Number(group.featured_priority || 50) || 50);
      setNote(group.verification_note || "");
    }
  }, [open, group]);

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-h-[90dvh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" />
            Verify &amp; Push Group to Top
          </DialogTitle>
          <DialogDescription>
            {group.name} · Award a Verified Crowdfunder badge or push this cause to the top of Discover.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Toggle 1: Special Verified Crowdfunder Badge */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
                <BadgeCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">Verified Crowdfunder Badge</p>
                <p className="text-xs text-muted-foreground">
                  Displays the official trust seal on Discover, group details, and share links.
                </p>
              </div>
            </div>
            <Switch checked={isVerified} onCheckedChange={setIsVerified} />
          </div>

          {/* Toggle 2: Push to Top of Discover (Pin) */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-white">
                <Pin className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">Push to Top of Discover</p>
                <p className="text-xs text-muted-foreground">
                  Pins this group in the Spotlight section ahead of regular community pools.
                </p>
              </div>
            </div>
            <Switch
              checked={isPinned}
              onCheckedChange={(checked) => {
                setIsPinned(checked);
                if (checked && !spotlightLabel.trim()) {
                  setSpotlightLabel("Most Needed");
                }
              }}
            />
          </div>

          {/* Spotlight Label Presets + Custom Input */}
          <div className="space-y-2">
            <Label htmlFor="spotlight-label-input" className="flex items-center gap-1.5 text-xs font-bold">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              Spotlight Tag (e.g. Most Needed, Urgent Cause, Verified)
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {SPOTLIGHT_LABEL_PRESETS.map((preset) => {
                const active = spotlightLabel.trim().toLowerCase() === preset.toLowerCase();
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setSpotlightLabel(active ? "" : preset);
                      if (!active && !isPinned) setIsPinned(true);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-accent"
                    )}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
            <Input
              id="spotlight-label-input"
              placeholder="Or type any custom spotlight label (leave empty for none)…"
              value={spotlightLabel}
              onChange={(e) => setSpotlightLabel(e.target.value)}
              maxLength={32}
              className="h-11 rounded-xl"
            />
          </div>

          {/* Priority Tier (when pinned) */}
          {isPinned && (
            <div className="space-y-2">
              <Label className="text-xs font-bold">Top Ranking Priority</Label>
              <div className="grid grid-cols-3 gap-2">
                {PRIORITY_TIERS.map((tier) => (
                  <button
                    key={tier.value}
                    type="button"
                    data-selected={priority === tier.value}
                    onClick={() => setPriority(tier.value)}
                    className="cp-tile-option p-2.5 text-left"
                  >
                    <span className="block text-xs font-bold text-foreground">{tier.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                      {tier.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Admin Note */}
          <div className="space-y-1.5">
            <Label htmlFor="spotlight-note" className="text-xs font-semibold">
              Verification / Promotion Note (internal audit)
            </Label>
            <Textarea
              id="spotlight-note"
              rows={2}
              placeholder="e.g. Verified mosque committee documents and confirmed urgent roof repair…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              onConfirm({
                groupId: group.id,
                isVerified,
                isPinned,
                spotlightLabel: spotlightLabel.trim(),
                featuredPriority: isPinned ? priority : 0,
                note: note.trim(),
              })
            }
            className="gap-1.5 rounded-xl font-bold"
          >
            <Sparkles className="h-4 w-4" />
            {pending ? "Saving…" : "Save Spotlight & Badge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================================
 * 7. VERIFY ORGANIZER / CROWDFUNDER ACCOUNT DIALOG
 * ========================================================================== */
interface VerifyOrganizerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any | null;
  pending: boolean;
  onConfirm: (payload: {
    userId: string;
    isVerified: boolean;
    badgeLabel: string;
    applyToGroups: boolean;
  }) => Promise<void>;
}

export const VerifyOrganizerDialog: React.FC<VerifyOrganizerDialogProps> = ({
  open,
  onOpenChange,
  user,
  pending,
  onConfirm,
}) => {
  const [isVerified, setIsVerified] = useState(true);
  const [badgeLabel, setBadgeLabel] = useState("Verified Crowdfunder");
  const [applyToGroups, setApplyToGroups] = useState(true);

  useEffect(() => {
    if (open && user) {
      setIsVerified(user.is_verified_organizer ? true : true);
      setBadgeLabel(user.organizer_badge_label || "Verified Crowdfunder");
      setApplyToGroups(true);
    }
  }, [open, user]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" />
            Verified Crowdfunder Badge
          </DialogTitle>
          <DialogDescription>
            {user.name || user.email} · Grant or revoke verified crowdfunder organizer status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/30 p-3.5">
            <div>
              <p className="text-sm font-bold text-foreground">Verified Crowdfunder Status</p>
              <p className="text-xs text-muted-foreground">
                Marks this organizer as officially vetted by CollectiPay.
              </p>
            </div>
            <Switch checked={isVerified} onCheckedChange={setIsVerified} />
          </div>

          {isVerified && (
            <div className="space-y-2">
              <Label htmlFor="organizer-badge-label" className="text-xs font-bold">
                Special Badge Title
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {ORGANIZER_BADGE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBadgeLabel(preset)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                      badgeLabel === preset
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-muted/40 text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <Input
                id="organizer-badge-label"
                value={badgeLabel}
                onChange={(e) => setBadgeLabel(e.target.value)}
                maxLength={36}
                className="h-11 rounded-xl"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/25 p-3">
            <div>
              <p className="text-xs font-bold text-foreground">
                Also {isVerified ? "verify" : "unverify"} all their active groups
              </p>
              <p className="text-[11px] text-muted-foreground">
                Syncs the Verified Crowdfunder badge across every pool created by this user.
              </p>
            </div>
            <Switch checked={applyToGroups} onCheckedChange={setApplyToGroups} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              onConfirm({
                userId: user.id,
                isVerified,
                badgeLabel: badgeLabel.trim() || "Verified Crowdfunder",
                applyToGroups,
              })
            }
            className="rounded-xl font-bold"
          >
            {pending ? "Saving…" : isVerified ? "Grant Verified Badge" : "Remove Verified Badge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
