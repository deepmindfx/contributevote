import { supabase } from "@/integrations/supabase/client";

export const GroupContributionService = {
  async getPendingBankTransfers(groupId: string) {
    const { data, error } = await supabase.rpc("list_group_bank_transfer_assignments", { p_group_id: groupId });
    if (error) throw new Error(error.message);
    return data;
  },

  async verifyBankTransfer(paymentId: string, account: string) {
    const { error } = await supabase.rpc("assign_group_bank_transfer", {
      p_payment_id: paymentId, p_account: account.trim(), p_grant_vote: true,
    });
    if (error) throw new Error(error.message);
  },
};
