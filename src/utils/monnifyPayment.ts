
import { getAuthToken } from "@/services/monnify/auth";
import { createInvoice } from "@/services/monnify/payments";
import { toast } from "sonner";
import { createTransaction } from "@/services/localStorage/transactionOperations";

interface PayWithMonnifyProps {
  amount: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
  contribution?: {
    id: string;
    name: string;
    accountReference?: string;
  };
  anonymous?: boolean;
  onSuccess?: (response: any) => void;
  onClose?: () => void;
}

export const payWithMonnify = async ({
  amount,
  user,
  contribution,
  anonymous = false,
  onSuccess,
  onClose
}: PayWithMonnifyProps) => {
  try {
    // Validate amount
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      if (onClose) onClose();
      return;
    }
    
    // Check if authenticated
    if (!user || !user.id) {
      toast.error("You must be logged in to make a payment");
      if (onClose) onClose();
      return;
    }
    
    // Create payment description
    const description = contribution 
      ? `Contribution to ${contribution.name}${anonymous ? ' (Anonymous)' : ''}`
      : `Wallet top-up by ${user.name}`;
    
    // Prepare invoice data
    const invoiceData: any = {
      amount,
      customerName: user.name,
      customerEmail: user.email,
      description,
    };
    
    // Add contribution details if making a contribution
    if (contribution) {
      invoiceData.contributionId = contribution.id;
      invoiceData.contributionName = contribution.name;
      
      // If we have an account reference for the contribution, include it
      if (contribution.accountReference) {
        console.log(`Using account reference ${contribution.accountReference} for contribution payment`);
        invoiceData.contributionAccountReference = contribution.accountReference;
      } else {
        console.warn("No account reference found for contribution:", contribution.id);
      }
    }
    
    console.log("Creating invoice with data:", invoiceData);
    
    // Create invoice
    try {
      const response = await createInvoice(invoiceData);
      
      if (!response || !response.checkoutUrl) {
        throw new Error("Failed to create payment invoice");
      }
      
      // Open checkout in new window
      const checkoutWindow = window.open(response.checkoutUrl, "_blank");
      
      // If window was blocked, show error
      if (!checkoutWindow) {
        toast.error("Please allow pop-ups to complete payment");
        if (onClose) onClose();
        return;
      }
      
      // Create a local transaction record with the correct transaction type
      const transactionData = {
        userId: user.id,
        type: "deposit" as const, // Type assertion to allowed values
        amount,
        contributionId: contribution ? contribution.id : "",
        description,
        status: "pending" as const, // Fix the type error by specifying the exact allowed value
        anonymous: !!anonymous,
        reference: response.invoiceReference || undefined,
        metaData: {
          paymentReference: response.paymentReference,
          invoiceReference: response.invoiceReference,
          contributionId: contribution?.id,
          contributionName: contribution?.name
        }
      };
      
      createTransaction(transactionData);
      
      // Call success callback
      if (onSuccess) {
        onSuccess(response);
      }
      
      toast.success("Payment initialized. Complete your payment in the new window.");
    } catch (error) {
      console.error("Payment error:", error);
      if (error instanceof Error) {
        toast.error(error.message || "Failed to create payment invoice. Please try again.");
      } else {
        toast.error("Failed to create payment invoice. Please try again.");
      }
      if (onClose) onClose();
    }
  } catch (error) {
    console.error("Error setting up payment:", error);
    toast.error("Failed to set up payment. Please try again.");
    if (onClose) onClose();
  }
};

export default payWithMonnify;
