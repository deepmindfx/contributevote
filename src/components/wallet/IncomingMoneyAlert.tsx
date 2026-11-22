import { ArrowDownLeft } from "lucide-react";
import { toast } from "sonner";
import type { NotificationRecord } from "@/services/supabase/notificationService";
import "./incoming-money-alert.css";

const incoming = new Set(["wallet_deposit", "wallet_credit", "bank_transfer_received", "group_payment_received", "refund_completed"]);

export function announceIncomingMoney(notification: NotificationRecord, vibrate: boolean) {
  if (!incoming.has(notification.type) || document.visibilityState !== "visible") return;
  const amount = notification.message.match(/₦[\d,]+(?:\.\d{1,2})?/)?.[0];
  const type = notification.type === "refund_completed" ? "Group refund"
    : notification.type === "group_payment_received" || notification.type === "bank_transfer_received" ? "Group payment" : "Wallet credit";
  if (vibrate && typeof navigator.vibrate === "function") navigator.vibrate([110, 70, 150]);
  toast.custom(() => (
    <div data-vibrate={vibrate} className="incoming-money-alert flex w-full max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-emerald-200/35 bg-[#103b2c] p-3 text-white shadow-xl sm:w-80">
      <img src="/collectipay-mark.svg" alt="" width={38} height={38} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Money received</p>
        <p className="text-xs text-emerald-100/75">{type}</p>
      </div>
      {amount && <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-[#d9f7ac]"><ArrowDownLeft size={15} aria-hidden="true" />{amount}</span>}
    </div>
  ), { id: "money-received-" + notification.id, duration: 5000 });
}
