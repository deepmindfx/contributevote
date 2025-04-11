
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { 
  getUserReservedAccount, 
  createUserReservedAccount, 
  getReservedAccountTransactions,
  ReservedAccountData
} from "@/services/wallet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { idFormSchema, IdFormValues } from "@/components/wallet/IdFormDialog";

export const useReservedAccount = () => {
  const { user, refreshData } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [accountDetails, setAccountDetails] = useState<ReservedAccountData | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [showIdForm, setShowIdForm] = useState(false);
  
  // Initialize the form
  const form = useForm<IdFormValues>({
    resolver: zodResolver(idFormSchema),
    defaultValues: {
      idType: "bvn",
      idNumber: "",
    },
  });
  
  useEffect(() => {
    // Check if user already has a reserved account
    if (user?.reservedAccount) {
      setAccountDetails(user.reservedAccount);
      
      // If account details exist but the accountNumber or bankName is undefined, refresh account details
      if (!user.reservedAccount.accountNumber || !user.reservedAccount.bankName) {
        handleRefresh();
      }
    }
  }, [user]);
  
  const handleCreateAccount = async (values?: IdFormValues) => {
    setIsLoading(true);
    try {
      if (!user || !user.id) {
        toast.error("User information not available. Please log in again.");
        return;
      }
      
      if (!values) {
        setShowIdForm(true);
        setIsLoading(false);
        return;
      }
      
      // Close the ID form dialog after submission
      setShowIdForm(false);
      
      const result = await createUserReservedAccount(user.id, values.idType, values.idNumber);
      if (result) {
        console.log("Reserved account created:", result);
        setAccountDetails(result);
        refreshData();
        
        // Also fetch transactions after creating account
        if (result.accountReference) {
          await getReservedAccountTransactions(result.accountReference);
          refreshData();
        }
        
        toast.success("Virtual account created successfully");
      }
    } catch (error) {
      console.error("Error creating reserved account:", error);
      toast.error("Failed to create reserved account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      if (!user || !user.id) {
        toast.error("User information not available. Please log in again.");
        return;
      }
      
      const result = await getUserReservedAccount(user.id);
      if (result) {
        console.log("Retrieved account details:", result);
        setAccountDetails(result);
        
        // Fetch transactions when refreshing account details
        if (result.accountReference) {
          await getReservedAccountTransactions(result.accountReference);
        }
        
        refreshData();
        toast.success("Account details refreshed");
      }
    } catch (error) {
      console.error("Error refreshing reserved account:", error);
      toast.error("Failed to refresh account details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };
  
  const onSubmitIdForm = (values: IdFormValues) => {
    handleCreateAccount(values);
  };
  
  return {
    isLoading,
    accountDetails,
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
