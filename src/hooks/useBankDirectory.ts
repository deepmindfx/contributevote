import { useQuery } from "@tanstack/react-query";
import { SupabaseApiService } from "@/services/supabase/apiService";
import type { BankOption } from "@/services/supabase/beneficiaryService";

export function useBankDirectory(enabled = true) {
  return useQuery({
    queryKey: ["nigerian-bank-directory"],
    enabled,
    staleTime: 15 * 60_000,
    retry: false,
    queryFn: async (): Promise<BankOption[]> => {
      const result = await SupabaseApiService.getBanks();
      if (!Array.isArray(result?.data)) throw new Error("Bank directory is unavailable.");
      const banks = new Map<string, BankOption>();
      for (const entry of result.data) {
        if (typeof entry?.name !== "string" || !entry.name.trim() || typeof entry.code !== "string" || !/^[0-9a-z]{2,12}$/i.test(entry.code)) continue;
        banks.set(entry.code, { code: entry.code, name: entry.name.trim() });
      }
      if (!banks.size) throw new Error("Bank directory is unavailable.");
      return [...banks.values()];
    },
  });
}
