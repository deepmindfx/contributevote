import React, { useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  ArrowDown,
  Building2,
  Users,
  Wallet,
} from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { cn } from "@/lib/utils";
import "@/styles/brand-loader.css";

export type ReceiptKind =
  | "transfer"
  | "contribution"
  | "deposit"
  | "withdrawal"
  | "refund";

export interface ReceiptParty {
  label: string;
  name: string;
  subtitle?: string;
  bankName?: string;
}

export interface ReceiptMetaRow {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  highlight?: boolean;
}

export interface CollectiPayReceiptData {
  kind: ReceiptKind;
  title?: string;
  amount: number;
  fee?: number;
  currency?: string;
  status?: string;
  date?: string;
  reference?: string;
  transactionId?: string;
  sender?: ReceiptParty;
  recipient?: ReceiptParty;
  groupName?: string;
  paymentMethod?: string;
  narration?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  votingRightsGranted?: boolean;
  extraRows?: ReceiptMetaRow[];
}

interface CollectiPayReceiptProps {
  data: CollectiPayReceiptData;
  /** Show action bar (Download, Share, Done) beneath the receipt sheet */
  showActions?: boolean;
  onDone?: () => void;
  doneLabel?: string;
  className?: string;
  /** Optional external ref to the printable receipt sheet */
  sheetRef?: React.RefObject<HTMLDivElement>;
}

const formatNaira = (value: number, showDecimals = true) => {
  const num = Number.isFinite(value) ? value : 0;
  return `₦${num.toLocaleString("en-NG", {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
};

const formatDateTime = (raw?: string) => {
  if (!raw) {
    return new Date().toLocaleString("en-NG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const normalizeStatus = (status?: string) => {
  const s = (status || "completed").toLowerCase();
  if (["successful", "success", "completed", "paid", "approved"].includes(s)) {
    return {
      label: "Successful",
      tone: "success" as const,
      pillClass: "bg-[#dbf5b4] text-[#0c3027]",
      icon: CheckCircle2,
    };
  }
  if (["failed", "error", "rejected", "cancelled", "declined"].includes(s)) {
    return {
      label: "Failed",
      tone: "failed" as const,
      pillClass: "bg-red-500/20 text-red-100 border border-red-300/30",
      icon: XCircle,
    };
  }
  return {
    label: s === "new" || s === "initiated" ? "Processing" : "Pending",
    tone: "pending" as const,
    pillClass: "bg-amber-300/20 text-amber-100 border border-amber-200/30",
    icon: Clock,
  };
};

const KIND_TITLES: Record<ReceiptKind, string> = {
  transfer: "Bank Transfer",
  contribution: "Group Contribution",
  deposit: "Wallet Deposit",
  withdrawal: "Wallet Withdrawal",
  refund: "Group Refund",
};

export const CollectiPayReceipt: React.FC<CollectiPayReceiptProps> = ({
  data,
  showActions = true,
  onDone,
  doneLabel = "Done",
  className,
  sheetRef,
}) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const captureRef = sheetRef || internalRef;
  const [isExporting, setIsExporting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const statusMeta = normalizeStatus(data.status);
  const StatusIcon = statusMeta.icon;
  const totalAmount = data.amount + (data.fee || 0);
  const displayTitle = data.title || KIND_TITLES[data.kind];
  const filePrefix = `collectipay-${data.kind}-${(data.reference || data.transactionId || Date.now().toString()).slice(-10)}`;

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const renderCanvas = async () => {
    if (!captureRef.current) return null;
    return html2canvas(captureRef.current, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
  };

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const canvas = await renderCanvas();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `${filePrefix}.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Receipt saved as image");
    } catch (error) {
      console.error("Error exporting receipt:", error);
      toast.error("Failed to generate receipt image");
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    setIsExporting(true);
    try {
      const canvas = await renderCanvas();
      if (canvas && navigator.share) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png")
        );
        if (blob) {
          const file = new File([blob], `${filePrefix}.png`, { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `CollectiPay ${displayTitle} Receipt`,
              text: `${displayTitle} of ${formatNaira(data.amount)} via CollectiPay`,
              files: [file],
            });
            return;
          }
        }
      }
      // Graceful fallback: download image
      await handleDownload();
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Error sharing receipt:", error);
        toast.error("Could not share receipt");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const detailRows: ReceiptMetaRow[] = [];

  if (data.groupName && !data.recipient) {
    detailRows.push({ label: "Group", value: data.groupName, highlight: true });
  }
  if (data.paymentMethod) {
    detailRows.push({ label: "Channel", value: data.paymentMethod });
  }
  if (typeof data.fee === "number" && data.fee > 0) {
    detailRows.push({ label: "Transfer Amount", value: formatNaira(data.amount) });
    detailRows.push({ label: "Transaction Fee", value: formatNaira(data.fee) });
    detailRows.push({
      label: "Total Debited",
      value: formatNaira(totalAmount),
      highlight: true,
    });
  }
  detailRows.push({ label: "Date & Time", value: formatDateTime(data.date) });
  if (data.reference) {
    detailRows.push({
      label: "Reference",
      value: data.reference,
      mono: true,
      copyable: true,
    });
  }
  if (data.transactionId && data.transactionId !== data.reference) {
    detailRows.push({
      label: "Transaction ID",
      value: String(data.transactionId),
      mono: true,
      copyable: true,
    });
  }
  if (data.narration) {
    detailRows.push({ label: "Narration", value: data.narration });
  }
  if (data.extraRows) {
    detailRows.push(...data.extraRows);
  }

  const hasParties = Boolean(data.sender || data.recipient);

  return (
    <div className={cn("mx-auto w-full max-w-[26rem] space-y-4", className)}>
      {/* Printable / Exportable Receipt Ticket */}
      <div
        ref={captureRef}
        className="overflow-hidden rounded-[1.5rem] border border-[#dce7e1] bg-white text-[#102820] shadow-[0_20px_50px_-24px_rgba(12,48,39,0.32)]"
      >
        {/* Emerald Hero Band */}
        <div className="cp-receipt-hero px-6 pb-6 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CollectiPayMark size={28} />
              <span className="text-[15px] font-bold tracking-[-0.04em] text-white">
                CollectiPay
              </span>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                statusMeta.pillClass
              )}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {statusMeta.label}
            </span>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#b9decb]">
              {displayTitle}
            </p>
            <p className="mt-1.5 text-[2.35rem] font-extrabold leading-none tracking-[-0.045em] text-white tabular-nums">
              {data.kind === "deposit" || data.kind === "refund" ? "+" : ""}
              {formatNaira(data.amount)}
            </p>
            {data.groupName && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-[#e7f8ef]">
                <Users className="h-3.5 w-3.5 text-[#dbf5b4]" />
                <span className="max-w-[16rem] truncate">{data.groupName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Classic Perforated Ticket Divider */}
        <div className="cp-receipt-perforation" aria-hidden="true">
          <div className="cp-receipt-perforation-line" />
        </div>

        {/* Receipt Body */}
        <div className="space-y-4 bg-white px-6 pb-6 pt-2">
          {/* Sender -> Recipient Transfer Route */}
          {hasParties && (
            <div className="rounded-2xl border border-[#e6efe9] bg-[#f7faf8] p-3.5">
              {data.sender && (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e3f2ea] text-[#146c43]">
                      <Wallet className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[#5d776c]">
                        {data.sender.label}
                      </p>
                      <p className="truncate text-sm font-semibold text-[#102820]">
                        {data.sender.name}
                      </p>
                      {data.sender.subtitle && (
                        <p className="font-mono text-xs text-[#5d776c]">
                          {data.sender.subtitle}
                          {data.sender.bankName ? ` • ${data.sender.bankName}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {data.sender && data.recipient && (
                <div className="my-2 ml-3 flex items-center gap-2">
                  <ArrowDown className="h-3.5 w-3.5 text-[#229f63]" />
                  <div className="h-px flex-1 bg-[#e3ece7]" />
                </div>
              )}

              {data.recipient && (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#0c3027] text-[#dbf5b4]">
                      {data.kind === "contribution" ? (
                        <Users className="h-3.5 w-3.5" />
                      ) : (
                        <Building2 className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[#5d776c]">
                        {data.recipient.label}
                      </p>
                      <p className="truncate text-sm font-semibold text-[#102820]">
                        {data.recipient.name}
                      </p>
                      {(data.recipient.subtitle || data.recipient.bankName) && (
                        <p className="text-xs text-[#5d776c]">
                          {data.recipient.subtitle && (
                            <span className="font-mono">{data.recipient.subtitle}</span>
                          )}
                          {data.recipient.subtitle && data.recipient.bankName ? " • " : ""}
                          {data.recipient.bankName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Wallet Balance Snapshot (when available) */}
          {typeof data.balanceBefore === "number" &&
            typeof data.balanceAfter === "number" && (
              <div className="flex items-center justify-between rounded-xl border border-[#e6efe9] bg-[#f7faf8] px-3.5 py-2.5 text-xs">
                <span className="font-medium text-[#5d776c]">Wallet Balance</span>
                <span className="font-semibold tabular-nums text-[#102820]">
                  <span className="font-normal text-[#6f867c]">
                    {formatNaira(data.balanceBefore, false)}
                  </span>
                  {" → "}
                  <span className="text-[#146c43]">
                    {formatNaira(data.balanceAfter, false)}
                  </span>
                </span>
              </div>
            )}

          {/* Voting Rights Callout */}
          {data.votingRightsGranted && (
            <div className="flex items-center gap-2 rounded-xl bg-[#edf9f1] px-3.5 py-2.5 text-xs font-medium text-[#146c43]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#1e965b]" />
              <span>Group voting rights active for this pool</span>
            </div>
          )}

          {/* Structured Key-Value Ledger */}
          <dl className="divide-y divide-[#eef3f0] text-sm">
            {detailRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <dt className="shrink-0 text-xs font-medium text-[#5d776c]">
                  {row.label}
                </dt>
                <dd className="flex min-w-0 items-center justify-end gap-1.5 text-right">
                  <span
                    className={cn(
                      "truncate tabular-nums",
                      row.mono && "font-mono text-xs",
                      row.highlight
                        ? "font-bold text-[#102820]"
                        : "font-semibold text-[#17352b]"
                    )}
                    title={row.value}
                  >
                    {row.value}
                  </span>
                  {row.copyable && (
                    <button
                      type="button"
                      onClick={() => handleCopy(row.value, row.label)}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#5d776c] transition-colors hover:bg-[#edf4f0] hover:text-[#102820]"
                      aria-label={`Copy ${row.label}`}
                    >
                      {copiedKey === row.label ? (
                        <Check className="h-3.5 w-3.5 text-[#1e965b]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Authentic Verified Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-[#e6efe9] bg-[#f4f8f6] px-6 py-3 text-[11px] text-[#557065]">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1e965b]" />
            Verified by CollectiPay
          </span>
          <span className="font-medium text-[#6f867c]">Save together. Decide together.</span>
        </div>
      </div>

      {/* Native Action Bar (outside export capture) */}
      {showActions && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownload}
              disabled={isExporting}
              className="h-11 rounded-xl font-semibold"
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Saving…" : "Save image"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleShare}
              disabled={isExporting}
              className="h-11 rounded-xl font-semibold"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share receipt
            </Button>
          </div>
          {onDone && (
            <Button
              type="button"
              onClick={onDone}
              className="h-12 w-full rounded-xl font-semibold"
            >
              {doneLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default CollectiPayReceipt;
