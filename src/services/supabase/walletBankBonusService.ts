import { supabase } from "@/integrations/supabase/client";

export interface WalletBankBonusOffer {
  amount: number;
}

export interface WalletBankBonusReport extends WalletBankBonusOffer {
  enabled: boolean;
  verification_ready: boolean;
  claim_limit: number;
  claimed: number;
  remaining: number;
  total_credited: number;
}

export async function getWalletBankBonusOffer() {
  const { data, error } = await supabase.rpc("get_wallet_bank_bonus_offer");
  if (error) throw error;
  return data as unknown as WalletBankBonusOffer | null;
}

export async function getWalletBankBonusReport() {
  const { data, error } = await supabase.rpc("admin_wallet_bank_bonus_report");
  if (error || !data) throw new Error(error?.message || "Bonus settings are unavailable.");
  return data as unknown as WalletBankBonusReport;
}

export async function updateWalletBankBonus(enabled: boolean, amount: number, claimLimit: number) {
  const { data, error } = await supabase.rpc("admin_update_wallet_bank_bonus", {
    p_enabled: enabled,
    p_amount: amount,
    p_claim_limit: claimLimit,
  });
  if (error || !data) throw new Error(error?.message || "Bonus settings could not be saved.");
  return data as unknown as WalletBankBonusReport;
}
