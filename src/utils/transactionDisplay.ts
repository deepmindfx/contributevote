/**
 * Shared helpers for extracting clean, human-readable sender, recipient,
 * payment channel, and failure metadata across CollectiPay transaction ledgers
 * and receipts (WalletHistory, ActivityHistory, Dashboard ActivityList).
 */

const PLACEHOLDER_PARTY_NAMES = new Set([
  "anonymous",
  "anonymous customer",
  "unknown",
  "unknown customer",
  "unknown sender",
  "customer",
  "n/a",
  "null",
  "undefined",
  // Platform / aggregator names that Flutterwave reports as the sender
  // when a card-funded deposit lands on a virtual account.
  "collectipay",
  "flutterwave",
  "paystack",
]);

export function metaText(meta: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = meta[key];
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
  }
  return undefined;
}

export function cleanPartyName(value?: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (PLACEHOLDER_PARTY_NAMES.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

export function getDepositSender(meta: Record<string, unknown>): {
  name?: string;
  bankName?: string;
  accountNumber?: string;
} {
  const candidates = [
    meta.senderName,
    meta.originatorName,
    meta.originator_name,
    meta.sender_name,
    meta.payerName,
    meta.contributorName,
    // Flutterwave card/wallet checkout: customer name from Flutterwave API
    meta.customerName,
    meta.customer_name,
    meta.flwCustomerName,
  ];
  let name: string | undefined;
  for (const candidate of candidates) {
    const cleaned = cleanPartyName(candidate);
    if (cleaned) {
      name = cleaned;
      break;
    }
  }

  const bankName = metaText(
    meta,
    "senderBank",
    "bankName",
    "bank_name",
    "sender_bank",
    "paymentBank"
  );

  const accountNumber = metaText(
    meta,
    "senderAccount",
    "originatorAccountNumber",
    "sender_account_masked",
    "originator_account_number",
    "originatoraccountnumber"
  );

  return { name, bankName, accountNumber };
}

export function getTransferRecipient(meta: Record<string, unknown>): {
  name?: string;
  bankName?: string;
  accountNumber?: string;
} {
  const candidates = [
    meta.beneficiary_name,
    meta.recipientName,
    meta.account_name,
    meta.full_name,
    meta.recipient_name,
  ];
  let name: string | undefined;
  for (const candidate of candidates) {
    const cleaned = cleanPartyName(candidate);
    if (cleaned) {
      name = cleaned;
      break;
    }
  }

  const bankName = metaText(meta, "bank_name", "bankName", "recipientBank");
  const accountNumber = metaText(meta, "account_number", "accountNumber");

  return { name, bankName, accountNumber };
}

export function formatPaymentMethodLabel(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    bank_transfer: "Bank Transfer",
    wallet: "CollectiPay Wallet",
    wallet_transfer: "CollectiPay Wallet",
    card: "Debit / Credit Card",
    ussd: "USSD Transfer",
    account: "Bank Account",
    flutterwave: "Flutterwave",
    transfer: "Bank Transfer",
  };
  if (map[normalized]) return map[normalized];
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function getFailureReason(
  meta: Record<string, unknown>,
  status?: string | null
): string | undefined {
  if (!status || !["failed", "rejected", "error"].includes(status.toLowerCase())) {
    return undefined;
  }
  const raw = metaText(meta, "complete_message", "failureReason", "error", "reason");
  if (!raw) return undefined;
  if (raw.toLowerCase().includes("insufficient funds in customer wallet")) {
    return "Payout settlement wallet is awaiting bank clearing (your CollectiPay wallet was automatically refunded).";
  }
  return raw;
}
