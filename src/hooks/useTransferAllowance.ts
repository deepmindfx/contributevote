import { useEffect, useState } from "react";
import { getTransferAllowance } from "@/services/supabase/pricingService";
import type { TransferAllowance } from "@/services/supabase/pricingService";

export function useTransferAllowance(userId?: string) {
  const [allowance, setAllowance] = useState<TransferAllowance>();
  const [loadError, setLoadError] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = () => {
    setAllowance(undefined);
    setLoadError(false);
    setVersion((previous) => previous + 1);
  };

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void getTransferAllowance().then(
      (result) => { if (active) setAllowance(result); },
      () => { if (active) setLoadError(true); },
    );
    return () => { active = false; };
  }, [userId, version]);

  return { allowance, loadError, reload };
}
