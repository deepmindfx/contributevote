import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import type { NotificationRecord } from "@/services/supabase/notificationService";
import { playPaymentAlertSound } from "@/services/paymentAlertAudio";
import "./incoming-money-alert.css";

const incoming = new Set(["wallet_deposit", "wallet_credit", "bank_transfer_received", "group_payment_received", "refund_completed"]);

export function announcePayment(notification: NotificationRecord, vibrate: boolean, sound: boolean) {
  const credit = incoming.has(notification.type);
  const sent = notification.type === "transfer_completed";
  const failed = notification.type === "transfer_failed";
  if ((!credit && !sent && !failed) || document.visibilityState !== "visible") return;
  const groupPayment = notification.type === "group_payment_received" || notification.type === "bank_transfer_received";
  if (sound) {
    if (groupPayment) playPaymentAlertSound("group");
    else if (notification.type === "wallet_deposit" || notification.type === "wallet_credit") playPaymentAlertSound("wallet");
  }
  const amount = notification.message.match(/₦[\d,]+(?:\.\d{1,2})?/)?.[0];
  const detail = notification.type === "refund_completed" ? "Group refund"
    : groupPayment ? "Group payment"
    : credit ? "Wallet credit" : "Bank transfer";
  const title = credit ? "Money received" : sent ? "Transfer sent" : "Transfer failed";
  const Direction = credit ? ArrowDownLeft : ArrowUpRight;
  // The transfer receipt already provides its own confirmation haptic.
  const shouldVibrate = vibrate && (credit || (sent && !/^\/transfer\/?$/.test(location.pathname)));
  if (shouldVibrate && typeof navigator.vibrate === "function") {
    try { navigator.vibrate([110, 70, 150]); } catch { /* The visual alert remains available. */ }
  }
  toast.custom(() => (
    <div data-vibrate={shouldVibrate} className="incoming-money-alert flex w-full max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-emerald-200/35 bg-[#103b2c] p-3 text-white shadow-xl sm:w-80">
      <img src="/collectipay-mark.svg" alt="" width={38} height={38} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-emerald-100/75">{detail}</p>
      </div>
      {amount && <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-[#d9f7ac]"><Direction size={15} aria-hidden="true" />{amount}</span>}
    </div>
  ), { id: "payment-" + notification.id, duration: 5000 });
}
