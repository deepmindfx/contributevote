import { supabase } from "@/integrations/supabase/client";
import { getTransferRecipient, metaText } from "@/utils/transactionDisplay";

export interface BankOption {
  code: string;
  name: string;
}

export interface SavedBeneficiaryPreference {
  key: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  nickname?: string;
  favorite?: boolean;
  updatedAt?: string;
}

export interface TransferBeneficiary {
  key: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  nickname?: string;
  favorite: boolean;
  lastTransferredAt: string;
  transferCount: number;
  isOwnAccount: boolean;
}

export function beneficiaryKey(bankCode: string, accountNumber: string): string {
  return `${bankCode.trim()}:${accountNumber.trim()}`;
}

export function formatAccountNumberSpaced(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length !== 10) return accountNumber;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function getAmountMagnitudeLabel(amount: number): string | null {
  if (!Number.isFinite(amount) || amount < 100) return null;
  if (amount < 1_000) return "Hundreds";
  if (amount < 10_000) return "Thousands";
  if (amount < 100_000) return "Ten Thousands";
  if (amount < 1_000_000) return "Hundred Thousands";
  return "Millions";
}

export interface BankBadgeStyle {
  initials: string;
  bg: string;
  text: string;
}

const BANK_BRANDS: Array<{ match: string; initials: string; bg: string; text: string }> = [
  { match: "opay", initials: "OP", bg: "#00B876", text: "#FFFFFF" },
  { match: "moniepoint", initials: "MP", bg: "#1A56DB", text: "#FFFFFF" },
  { match: "palmpay", initials: "PP", bg: "#6D28D9", text: "#FFFFFF" },
  { match: "kuda", initials: "KD", bg: "#40196D", text: "#FFFFFF" },
  { match: "guaranty trust", initials: "GT", bg: "#DD4F05", text: "#FFFFFF" },
  { match: "gtb", initials: "GT", bg: "#DD4F05", text: "#FFFFFF" },
  { match: "access", initials: "AC", bg: "#EA580C", text: "#FFFFFF" },
  { match: "zenith", initials: "ZB", bg: "#C8102E", text: "#FFFFFF" },
  { match: "united bank", initials: "UB", bg: "#D9261C", text: "#FFFFFF" },
  { match: "uba", initials: "UB", bg: "#D9261C", text: "#FFFFFF" },
  { match: "first bank", initials: "FB", bg: "#003B65", text: "#FFFFFF" },
  { match: "fidelity", initials: "FD", bg: "#0D9488", text: "#FFFFFF" },
  { match: "fcmb", initials: "FC", bg: "#5B21B6", text: "#FFFFFF" },
  { match: "wema", initials: "WM", bg: "#9333EA", text: "#FFFFFF" },
  { match: "sterling", initials: "ST", bg: "#DC2626", text: "#FFFFFF" },
  { match: "union bank", initials: "UN", bg: "#0284C7", text: "#FFFFFF" },
  { match: "stanbic", initials: "SB", bg: "#1D4ED8", text: "#FFFFFF" },
  { match: "polaris", initials: "PL", bg: "#7E22CE", text: "#FFFFFF" },
  { match: "ecobank", initials: "EC", bg: "#0369A1", text: "#FFFFFF" },
  { match: "flutterwave", initials: "FW", bg: "#075847", text: "#DBF5B4" },
  { match: "jaiz", initials: "JZ", bg: "#15803D", text: "#FFFFFF" },
  { match: "taj", initials: "TJ", bg: "#B91C1C", text: "#FFFFFF" },
  { match: "providus", initials: "PV", bg: "#CA8A04", text: "#FFFFFF" },
  { match: "vfd", initials: "VF", bg: "#16A34A", text: "#FFFFFF" },
  { match: "rubies", initials: "RB", bg: "#BE123C", text: "#FFFFFF" },
];

const FALLBACK_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: "#075847", text: "#DBF5B4" },
  { bg: "#0F766E", text: "#FFFFFF" },
  { bg: "#1D4ED8", text: "#FFFFFF" },
  { bg: "#6D28D9", text: "#FFFFFF" },
  { bg: "#B45309", text: "#FFFFFF" },
  { bg: "#BE123C", text: "#FFFFFF" },
];

export function getBankBadgeStyle(bankName?: string | null): BankBadgeStyle {
  const clean = (bankName || "Bank").trim();
  const lower = clean.toLowerCase();
  const known = BANK_BRANDS.find((entry) => lower.includes(entry.match));
  if (known) {
    return { initials: known.initials, bg: known.bg, text: known.text };
  }
  const words = clean.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : clean.slice(0, 2).toUpperCase() || "BK";
  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = (hash * 31 + clean.charCodeAt(i)) | 0;
  const palette = FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
  return { initials, ...palette };
}

function isLikelyOwnAccount(accountName: string, userName?: string | null): boolean {
  if (!userName) return false;
  const cleanUser = userName
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
  if (cleanUser.length < 2) return false;
  const cleanAcct = accountName.toLowerCase();
  const matches = cleanUser.filter((token) => cleanAcct.includes(token));
  return matches.length >= 2;
}

export function readSavedBeneficiaries(
  preferences: unknown
): {
  saved: SavedBeneficiaryPreference[];
  hiddenKeys: Set<string>;
  hiddenAtByKey: Record<string, string>;
} {
  const prefs = (preferences && typeof preferences === "object" ? preferences : {}) as Record<
    string,
    unknown
  >;
  const rawSaved = Array.isArray(prefs.savedBeneficiaries) ? prefs.savedBeneficiaries : [];
  const saved: SavedBeneficiaryPreference[] = [];
  for (const entry of rawSaved) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const accountNumber = typeof item.accountNumber === "string" ? item.accountNumber.trim() : "";
    const bankCode = typeof item.bankCode === "string" ? item.bankCode.trim() : "";
    const bankName = typeof item.bankName === "string" ? item.bankName.trim() : "";
    const accountName = typeof item.accountName === "string" ? item.accountName.trim() : "";
    if (!/^\d{10}$/.test(accountNumber) || !bankCode || !accountName) continue;
    saved.push({
      key: beneficiaryKey(bankCode, accountNumber),
      accountNumber,
      bankCode,
      bankName: bankName || bankCode,
      accountName,
      nickname: typeof item.nickname === "string" && item.nickname.trim() ? item.nickname.trim() : undefined,
      favorite: Boolean(item.favorite),
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
    });
  }
  const rawHidden = Array.isArray(prefs.hiddenBeneficiaries) ? prefs.hiddenBeneficiaries : [];
  const hiddenKeys = new Set<string>(
    rawHidden.filter((value): value is string => typeof value === "string" && value.length > 0)
  );
  const rawHiddenAt =
    prefs.hiddenBeneficiaryTimestamps && typeof prefs.hiddenBeneficiaryTimestamps === "object"
      ? (prefs.hiddenBeneficiaryTimestamps as Record<string, unknown>)
      : {};
  const hiddenAtByKey: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawHiddenAt)) {
    if (typeof v === "string" && v.length > 0) {
      hiddenAtByKey[k] = v;
    }
  }
  return { saved, hiddenKeys, hiddenAtByKey };
}

export async function fetchTransferBeneficiaries(
  userId: string,
  banks: BankOption[] | undefined,
  preferences: unknown,
  userName?: string | null
): Promise<TransferBeneficiary[]> {
  const { saved, hiddenKeys, hiddenAtByKey } = readSavedBeneficiaries(preferences);
  const savedByKey = new Map(saved.map((item) => [item.key, item]));
  const bankNameByCode = new Map((banks || []).map((b) => [b.code.toLowerCase(), b.name]));
  const bankCodeByName = new Map((banks || []).map((b) => [b.name.toLowerCase(), b.code]));

  const { data: rows, error } = await supabase
    .from("transactions")
    .select("created_at, status, metadata")
    .eq("user_id", userId)
    .eq("type", "transfer")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.warn("Could not load recent transfer recipients:", error.message);
  }

  const merged = new Map<string, TransferBeneficiary>();

  for (const row of rows || []) {
    const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<
      string,
      unknown
    >;
    const recipient = getTransferRecipient(meta);
    const accountNumber = recipient.accountNumber?.replace(/\D/g, "") || "";
    const rawBankCode = metaText(meta, "account_bank", "bank_code", "bankCode") || "";
    const resolvedBankCode =
      rawBankCode ||
      (recipient.bankName ? bankCodeByName.get(recipient.bankName.toLowerCase()) || "" : "");

    if (!/^\d{10}$/.test(accountNumber) || !resolvedBankCode) continue;

    const resolvedBankName =
      bankNameByCode.get(resolvedBankCode.toLowerCase()) ||
      (recipient.bankName && recipient.bankName !== resolvedBankCode ? recipient.bankName : "") ||
      resolvedBankCode;

    const accountName = recipient.name || "Bank Recipient";
    const key = beneficiaryKey(resolvedBankCode, accountNumber);
    const pref = savedByKey.get(key);
    const rowTime = Date.parse(row.created_at || "");
    const hiddenAt = hiddenAtByKey[key] ? Date.parse(hiddenAtByKey[key]) : NaN;
    const isHidden =
      hiddenKeys.has(key) &&
      !pref?.favorite &&
      (Number.isNaN(hiddenAt) || Number.isNaN(rowTime) || rowTime <= hiddenAt);

    if (isHidden) continue;

    const existing = merged.get(key);
    if (existing) {
      existing.transferCount += 1;
      // Upgrade generic bank code/name if an older or newer entry has a cleaner label
      if (existing.bankName === existing.bankCode && resolvedBankName !== resolvedBankCode) {
        existing.bankName = resolvedBankName;
      }
      if (existing.accountName === "Bank Recipient" && accountName !== "Bank Recipient") {
        existing.accountName = accountName;
      }
    } else {
      merged.set(key, {
        key,
        accountNumber,
        bankCode: resolvedBankCode,
        bankName: pref?.bankName && pref.bankName !== resolvedBankCode ? pref.bankName : resolvedBankName,
        accountName: pref?.accountName || accountName,
        nickname: pref?.nickname,
        favorite: Boolean(pref?.favorite),
        lastTransferredAt: row.created_at || new Date().toISOString(),
        transferCount: 1,
        isOwnAccount: isLikelyOwnAccount(pref?.accountName || accountName, userName),
      });
    }
  }

  // Ensure any starred / nicknamed saved beneficiaries appear even if outside latest 80 transfers
  for (const pref of saved) {
    if (merged.has(pref.key)) continue;
    if (!pref.favorite && !pref.nickname) continue;
    const resolvedBankName =
      bankNameByCode.get(pref.bankCode.toLowerCase()) || pref.bankName || pref.bankCode;
    merged.set(pref.key, {
      key: pref.key,
      accountNumber: pref.accountNumber,
      bankCode: pref.bankCode,
      bankName: resolvedBankName,
      accountName: pref.accountName,
      nickname: pref.nickname,
      favorite: Boolean(pref.favorite),
      lastTransferredAt: pref.updatedAt || new Date(0).toISOString(),
      transferCount: 0,
      isOwnAccount: isLikelyOwnAccount(pref.accountName, userName),
    });
  }

  return Array.from(merged.values()).sort(
    (a, b) => Date.parse(b.lastTransferredAt) - Date.parse(a.lastTransferredAt)
  );
}

export function buildUpdatedBeneficiaryPreferences(
  currentPreferences: unknown,
  action:
    | { type: "upsert"; item: SavedBeneficiaryPreference }
    | { type: "hide"; key: string }
): Record<string, unknown> {
  const base =
    currentPreferences && typeof currentPreferences === "object"
      ? ({ ...(currentPreferences as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const { saved, hiddenKeys, hiddenAtByKey } = readSavedBeneficiaries(base);

  if (action.type === "hide") {
    hiddenKeys.add(action.key);
    const nextHiddenAt = { ...hiddenAtByKey, [action.key]: new Date().toISOString() };
    const nextSaved = saved.filter((entry) => entry.key !== action.key);
    return {
      ...base,
      savedBeneficiaries: nextSaved,
      hiddenBeneficiaries: Array.from(hiddenKeys).slice(-100),
      hiddenBeneficiaryTimestamps: nextHiddenAt,
    };
  }

  const nextKey = beneficiaryKey(action.item.bankCode, action.item.accountNumber);
  hiddenKeys.delete(nextKey);
  const nextHiddenAt = { ...hiddenAtByKey };
  delete nextHiddenAt[nextKey];
  const nextSaved = saved.filter((entry) => entry.key !== nextKey);
  if (action.item.favorite || action.item.nickname) {
    nextSaved.unshift({
      ...action.item,
      key: nextKey,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    ...base,
    savedBeneficiaries: nextSaved.slice(0, 60),
    hiddenBeneficiaries: Array.from(hiddenKeys).slice(-100),
    hiddenBeneficiaryTimestamps: nextHiddenAt,
  };
}
