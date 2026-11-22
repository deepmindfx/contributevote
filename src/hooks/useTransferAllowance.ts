import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTransferAllowance } from "@/services/supabase/pricingService";

export function useTransferAllowance(userId?: string) {
  const client = useQueryClient();
  const queryKey = ["transfer-allowance", userId] as const;
  const query = useQuery({
    queryKey,
    queryFn: getTransferAllowance,
    enabled: Boolean(userId),
    staleTime: 10_000,
    retry: false,
  });
  return {
    allowance: query.isError || query.isFetching ? undefined : query.data,
    loadError: query.isError && !query.isFetching,
    reload: () => void client.invalidateQueries({ queryKey }),
  };
}
