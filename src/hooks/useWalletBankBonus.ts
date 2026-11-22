import { useQuery } from "@tanstack/react-query";
import { getWalletBankBonusOffer } from "@/services/supabase/walletBankBonusService";

export const walletBankBonusOfferKey = ["wallet-bank-bonus"] as const;

export function useWalletBankBonus(userId?: string) {
  const { data, isError } = useQuery({
    queryKey: [...walletBankBonusOfferKey, userId],
    queryFn: getWalletBankBonusOffer,
    enabled: Boolean(userId),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
  return isError || !userId ? undefined : data;
}
