
import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";

export function useContributionActions() {
  const { contribute, requestWithdrawal, isGroupCreator } = useApp();
  
  const [contributionAmount, setContributionAmount] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalPurpose, setWithdrawalPurpose] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  const handleContribute = (contributionId: string) => {
    if (!contributionAmount || isNaN(Number(contributionAmount)) || Number(contributionAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    contribute(contributionId, Number(contributionAmount), anonymous);
    setContributionAmount("");
  };
  
  const handleRequestWithdrawal = (contributionId: string, currentAmount: number) => {
    if (!withdrawalAmount || isNaN(Number(withdrawalAmount)) || Number(withdrawalAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (Number(withdrawalAmount) > currentAmount) {
      toast.error("Requested amount exceeds available funds");
      return;
    }
    if (!withdrawalPurpose.trim()) {
      toast.error("Please enter a purpose for the withdrawal");
      return;
    }
    requestWithdrawal({
      contributionId: contributionId,
      amount: Number(withdrawalAmount),
      reason: withdrawalPurpose,
      beneficiary: "Group Creator",
      accountNumber: "0000000000", // Default value, would be replaced with user's account in real app
      bankName: "User's Bank", // Default value, would be replaced with user's bank in real app
      purpose: withdrawalPurpose
    });
    setWithdrawalAmount("");
    setWithdrawalPurpose("");
  };

  return {
    contributionAmount,
    setContributionAmount,
    withdrawalAmount,
    setWithdrawalAmount,
    withdrawalPurpose,
    setWithdrawalPurpose,
    anonymous,
    setAnonymous,
    handleContribute,
    handleRequestWithdrawal,
    isGroupCreator
  };
}
