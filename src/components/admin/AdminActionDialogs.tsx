import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
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

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000, 50000];

/* ============================================================================
 * 1. WALLET CREDIT / DEBIT DIALOG
 * ========================================================================== */
interface WalletAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any | null;
  pending: boolean;
  onConfirm: (payload: {
    userId: string;
    amount: number;
    direction: "credit" | "debit";
    reason: string;
  }) => Promise<void>;
}

export const WalletAdjustDialog: React.FC<WalletAdjustDialogProps> = ({
  open,
  onOpenChange,
  user,
  pending,
  onConfirm,
}) => {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setDirection("credit");
      setAmount("");
      setReason("");
    }
  }, [open, user?.id]);

  const numericAmount = Number(amount);
  const currentBalance = Number(user?.wallet_balance || 0);
  const insufficientForDebit = direction === "debit" && numericAmount > currentBalance;

  const submit = async () => {
    if (!user || !Number.isFinite(numericAmount) || numericAmount <= 0) return;
    await onConfirm({
      userId: user.id,
      amount: numericAmount,
      direction,
      reason: reason.trim() || (direction === "credit" ? "Admin wallet credit" : "Admin wallet debit"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Adjust User Wallet</DialogTitle>
          <DialogDescription>
            {user?.name || user?.email} · Current balance:{" "}
            <strong className="text-foreground tabular-nums">
              ₦{currentBalance.toLocaleString("en-NG")}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              data-selected={direction === "credit"}
              onClick={() => setDirection("credit")}
              className="cp-tile-option flex items-center gap-2.5 p-3 text-left"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <ArrowDownLeft className="h-4 w-4" />
              </span>
              <div>
                <span className="block text-sm font-bold">Credit</span>
                <span className="block text-[11px] text-muted-foreground">Add funds</span>
              </div>
            </button>
            <button
              type="button"
              data-selected={direction === "debit"}
              onClick={() => setDirection("debit")}
              className="cp-tile-option flex items-center gap-2.5 p-3 text-left"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-700 dark:text-red-300">
                <ArrowUpRight className="h-4 w-4" />
              </span>
              <div>
                <span className="block text-sm font-bold">Debit</span>
                <span className="block text-[11px] text-muted-foreground">Deduct funds</span>
              </div>
            </button>
          </div>

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
              placeholder={
                direction === "credit"
                  ? "e.g. Manual settlement / reconciliation refund"
                  : "e.g. Duplicate credit reversal"
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              pending ||
              !Number.isFinite(numericAmount) ||
              numericAmount <= 0 ||
              insufficientForDebit
            }
            variant={direction === "debit" ? "destructive" : "default"}
            className="rounded-xl"
          >
            {pending
              ? "Processing…"
              : direction === "credit"
              ? `Credit ₦${Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount.toLocaleString() : "0"}`
              : `Debit ₦${Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount.toLocaleString() : "0"}`}
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
  users: any[];
  groups: any[];
  presetUser?: any | null;
  presetAmlAlertId?: string | null;
  pending: boolean;
  onConfirm: (payload: {
    userId: string;
    amount: number;
    penaltyType: PenaltyType;
    reason: string;
    deductWallet: boolean;
    groupId?: string | null;
    amlAlertId?: string | null;
  }) => Promise<void>;
}

export const IssuePenaltyDialog: React.FC<IssuePenaltyDialogProps> = ({
  open,
  onOpenChange,
  users,
  groups,
  presetUser,
  presetAmlAlertId,
  pending,
  onConfirm,
}) => {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [penaltyType, setPenaltyType] = useState<PenaltyType>("policy_violation");
  const [amount, setAmount] = useState("2500");
  const [reason, setReason] = useState("");
  const [deductWallet, setDeductWallet] = useState(true);

  useEffect(() => {
    if (open) {
      setSelectedUserId(presetUser?.id || users[0]?.id || "");
      setSelectedGroupId("");
      setPenaltyType(presetAmlAlertId ? "aml_hold" : "policy_violation");
      setAmount(presetAmlAlertId ? "10000" : "2500");
      setReason("");
      setDeductWallet(true);
    }
  }, [open, presetUser?.id, presetAmlAlertId, users]);

  const targetUser = users.find((u) => u.id === selectedUserId) || presetUser;
  const numericAmount = Number(amount);
  const walletBalance = Number(targetUser?.wallet_balance || 0);
  const willMarkPending = deductWallet && numericAmount > walletBalance;

  const submit = async () => {
    if (!selectedUserId || !Number.isFinite(numericAmount) || numericAmount <= 0 || !reason.trim()) {
      return;
    }
    await onConfirm({
      userId: selectedUserId,
      amount: numericAmount,
      penaltyType,
      reason: reason.trim(),
      deductWallet,
      groupId: selectedGroupId || null,
      amlAlertId: presetAmlAlertId || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-h-[90dvh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-destructive" />
            Issue Compliance Penalty
          </DialogTitle>
          <DialogDescription>
            Record a formal fine, notify the user immediately, and optionally deduct from their wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* User selector if not locked */}
          {presetUser ? (
            <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm">
              <div>
                <p className="font-semibold text-foreground">{presetUser.name || presetUser.email}</p>
                <p className="text-xs text-muted-foreground">{presetUser.email}</p>
              </div>
              <span className="text-xs font-bold text-primary tabular-nums">
                Bal: ₦{walletBalance.toLocaleString("en-NG")}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Target user</Label>
              <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-xl border p-2">
                {users.slice(0, 40).map((u) => {
                  const selected = u.id === selectedUserId;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      data-selected={selected}
                      onClick={() => setSelectedUserId(u.id)}
                      className="cp-tile-option flex w-full items-center justify-between px-3 py-2 text-left text-xs"
                    >
                      <span className="min-w-0 truncate font-semibold">
                        {u.name || u.email}
                      </span>
                      <span className="ml-2 shrink-0 text-muted-foreground tabular-nums">
                        ₦{Number(u.wallet_balance || 0).toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Tactile Penalty Type Selector */}
          <div className="space-y-2">
            <Label>Penalty category</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PENALTY_TYPE_OPTIONS.map((opt) => {
                const selected = penaltyType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    data-selected={selected}
                    onClick={() => setPenaltyType(opt.value)}
                    className="cp-tile-option flex items-start justify-between gap-2 p-3 text-left"
                  >
                    <div>
                      <span className="block text-xs font-bold text-foreground">{opt.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                        {opt.description}
                      </span>
                    </div>
                    {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Group Link */}
          {groups.length > 0 && (
            <div className="space-y-2">
              <Label>Related group pool <span className="font-normal text-muted-foreground">· Optional</span></Label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedGroupId("")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-semibold",
                    !selectedGroupId
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-accent"
                  )}
                >
                  Account-level (none)
                </button>
                {groups.slice(0, 8).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGroupId(g.id)}
                    className={cn(
                      "max-w-[11rem] truncate rounded-full border px-2.5 py-1 text-xs font-semibold",
                      selectedGroupId === g.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-muted/40 text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="penalty-amount">Penalty amount (₦)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-destructive">
                ₦
              </span>
              <Input
                id="penalty-amount"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 rounded-xl pl-8 font-bold tabular-nums"
              />
            </div>
          </div>

          {/* Deduct Toggle */}
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3.5">
            <div>
              <p className="text-sm font-semibold text-foreground">Deduct immediately from wallet</p>
              <p className="text-xs text-muted-foreground">
                {willMarkPending
                  ? `Balance (₦${walletBalance.toLocaleString()}) is below fine — will log as Pending settlement.`
                  : "Debits wallet atomically and logs a compliance transaction receipt."}
              </p>
            </div>
            <Switch checked={deductWallet} onCheckedChange={setDeductWallet} />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="penalty-reason">Official reason (sent to user &amp; audit log)</Label>
            <Textarea
              id="penalty-reason"
              rows={3}
              placeholder="Explain the policy breach, late cycle, or AML finding clearly..."
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
            variant="destructive"
            onClick={submit}
            disabled={
              pending ||
              !selectedUserId ||
              !Number.isFinite(numericAmount) ||
              numericAmount <= 0 ||
              !reason.trim()
            }
            className="rounded-xl"
          >
            {pending ? "Issuing…" : `Issue ₦${Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount.toLocaleString() : "0"} Penalty`}
          </Button>
        </DialogFooter>
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
                {alert.user_profile?.bvn ? "BVN on file" : "No BVN"}
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
                Issue AML Penalty
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
  users: any[];
  presetUser?: any | null;
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
  users,
  presetUser,
  pending,
  onConfirm,
}) => {
  const [userId, setUserId] = useState("");
  const [severity, setSeverity] = useState<AmlAlertSeverity>("high");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setUserId(presetUser?.id || users[0]?.id || "");
      setSeverity("high");
      setAmount("");
      setTitle("");
      setDescription("");
    }
  }, [open, presetUser?.id, users]);

  const riskMap: Record<AmlAlertSeverity, number> = {
    low: 35,
    medium: 60,
    high: 82,
    critical: 95,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl">
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
            <div className="rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm font-semibold">
              {presetUser.name || presetUser.email}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Account to flag</Label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border p-2">
                {users.slice(0, 30).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    data-selected={userId === u.id}
                    onClick={() => setUserId(u.id)}
                    className="cp-tile-option flex w-full items-center justify-between px-3 py-2 text-left text-xs"
                  >
                    <span className="truncate font-semibold">{u.name || u.email}</span>
                    <span className="text-muted-foreground">{u.email}</span>
                  </button>
                ))}
              </div>
            </div>
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
                userId,
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

/* ============================================================================
 * 8. UNLINK / REMOVE USER BVN DIALOG
 * ========================================================================== */
interface RemoveBvnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any | null;
  pending: boolean;
  onConfirm: (payload: { userId: string; reason: string }) => Promise<void>;
}

export const RemoveBvnDialog: React.FC<RemoveBvnDialogProps> = ({
  open,
  onOpenChange,
  user,
  pending,
  onConfirm,
}) => {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
    }
  }, [open, user?.id]);

  if (!user) return null;

  const last4 = String(user.bvn || "").trim().slice(-4);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Unlink User BVN
          </DialogTitle>
          <DialogDescription>
            Remove the linked BVN ending in{" "}
            <strong className="font-mono text-foreground">***{last4}</strong> from{" "}
            <strong className="text-foreground">{user.name || user.email}</strong>. They will need to re-verify a valid 11-digit BVN before creating new groups.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="remove-bvn-reason" className="text-xs font-semibold">
              Reason (logged to audit trail &amp; sent to user)
            </Label>
            <Textarea
              id="remove-bvn-reason"
              rows={2}
              placeholder="e.g. User submitted wrong BVN digits and requested KYC reset"
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
            variant="destructive"
            disabled={pending}
            onClick={() =>
              onConfirm({
                userId: user.id,
                reason: reason.trim() || "BVN unlinked by Super Admin for KYC reset",
              })
            }
            className="rounded-xl font-bold"
          >
            {pending ? "Unlinking…" : "Unlink BVN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
