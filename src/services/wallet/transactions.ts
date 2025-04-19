
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { getCurrentUser, updateUser, updateUserById, addTransaction } from "../localStorage";

export const processReservedAccountTransaction = async (data: {
  transactionReference: string;
  paymentReference: string;
  amountPaid: number;
  totalPayable: number;
  settlementAmount: number;
  paidOn: string;
  paymentStatus: string;
  paymentDescription: string;
  metaData?: {
    contributionId?: string;
    userId?: string;
  };
  accountDetails: {
    accountName: string;
    accountNumber: string;
    bankCode: string;
    bankName: string;
  };
}) => {
  try {
    const {
      transactionReference,
      paymentReference,
      amountPaid,
      paymentStatus,
      paymentDescription,
      metaData,
      accountDetails,
      paidOn
    } = data;
    
    const currentUser = getCurrentUser();
    const userId = metaData?.userId || currentUser.id;
    
    const existingTransactions = await getTransactions();
    const existingTransaction = existingTransactions.find(t => 
      t.id === transactionReference || 
      (t.metaData && t.metaData.paymentReference === paymentReference)
    );
    
    if (existingTransaction) {
      return existingTransaction;
    }
    
    const transaction = {
      id: transactionReference || uuidv4(),
      userId,
      type: "deposit" as "deposit" | "withdrawal" | "transfer" | "vote",
      amount: amountPaid,
      contributionId: metaData?.contributionId || "",
      description: paymentDescription || "Bank transfer to virtual account",
      status: paymentStatus === "PAID" ? "completed" as "completed" | "pending" | "failed" : "pending" as "completed" | "pending" | "failed",
      createdAt: new Date(paidOn || Date.now()).toISOString(),
      metaData: {
        paymentReference,
        bankName: accountDetails?.bankName || '',
        accountNumber: accountDetails?.accountNumber || ''
      }
    };
    
    addTransaction(transaction);
    
    if (paymentStatus === "PAID") {
      if (userId === currentUser.id) {
        const updatedBalance = (currentUser.walletBalance || 0) + amountPaid;
        updateUser({
          ...currentUser,
          walletBalance: updatedBalance
        });
        toast.success(`Wallet funded with ₦${amountPaid.toLocaleString()}`);
      } else {
        updateUserById(userId, {
          walletBalance: (currentUser.walletBalance || 0) + amountPaid
        });
      }
    }
    
    return transaction;
  } catch (error) {
    console.error("Error processing transaction:", error);
    toast.error("Failed to process transaction. Please try again.");
    return null;
  }
};
