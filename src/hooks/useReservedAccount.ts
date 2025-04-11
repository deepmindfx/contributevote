
import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createReservedAccount, getReservedAccountDetails } from "@/services/wallet/reservedAccountService";
import { ReservedAccountData } from "@/services/wallet/types";

interface IdFormData {
  bvn: string;
  nin: string;
  idType: "bvn" | "nin";
}

export const useReservedAccount = () => {
  const { user, refreshData } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [showIdForm, setShowIdForm] = useState(false);
  const hasReservedAccount = !!user?.reservedAccount;
  const reservedAccount = user?.reservedAccount;

  const form = useForm<IdFormData>({
    defaultValues: {
      bvn: "",
      nin: "",
      idType: "bvn"
    }
  });

  const handleCreateAccount = async () => {
    setShowIdForm(true);
  };

  const onSubmitIdForm = async (data: IdFormData) => {
    setLoading(true);
    setError("");
    try {
      const idValue = data.idType === "bvn" ? data.bvn : data.nin;
      const result = await createReservedAccount(idValue, data.idType);
      
      if (result) {
        refreshData();
        setShowIdForm(false);
        toast.success("Virtual account created successfully");
      }
    } catch (error) {
      console.error("Error creating reserved account:", error);
      setError("Failed to create virtual account. Please try again.");
      toast.error("Failed to create virtual account");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!user?.reservedAccount?.accountReference) {
      toast.error("No account to refresh");
      return;
    }

    setLoading(true);
    try {
      const result = await getReservedAccountDetails(user.reservedAccount.accountReference);
      if (result) {
        refreshData();
        toast.success("Account details refreshed");
      }
    } catch (error) {
      console.error("Error refreshing account details:", error);
      toast.error("Failed to refresh account details");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    
    navigator.clipboard.writeText(text)
      .then(() => toast.success(`${label} copied to clipboard`))
      .catch(err => {
        console.error("Error copying to clipboard:", err);
        toast.error("Failed to copy to clipboard");
      });
  };

  const createAccount = async () => {
    setLoading(true);
    try {
      // This placeholder implementation uses a fake BVN
      const result = await createReservedAccount("22222222222", "bvn");
      if (result) {
        refreshData();
        toast.success("Virtual account created successfully");
      }
      return result;
    } catch (error) {
      console.error("Error creating reserved account:", error);
      toast.error("Failed to create virtual account");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createAccount,
    reservedAccount,
    hasReservedAccount,
    showFullDetails,
    setShowFullDetails,
    showIdForm,
    setShowIdForm,
    form,
    handleCreateAccount,
    handleRefresh,
    copyToClipboard,
    onSubmitIdForm
  };
};
