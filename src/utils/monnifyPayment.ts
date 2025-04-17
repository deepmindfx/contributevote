import { getAuthToken } from "@/services/monnify/auth";
import { createInvoice } from "@/services/monnify/payments";
import { toast } from "sonner";
import { createTransaction } from "@/services/localStorage/transactionOperations";
import { MonnifyApiResponse, SimpleResponse } from "@/services/monnify/types";

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
  paymentReference?: string;
  description?: string;
  anonymous?: boolean;
  onSuccess?: (response: any) => void;
  onClose?: () => void;
}

export const payWithMonnify = async ({
  amount,
  user,
  contribution,
  paymentReference,
  description,
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
    
    // Create payment description if not provided
    const paymentDescription = description || (contribution 
      ? `Contribution to ${contribution.name}${anonymous ? ' (Anonymous)' : ''}`
      : `Wallet top-up by ${user.name}`);

    // Generate payment reference if not provided  
    const invoiceReference = paymentReference || `PAY-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    
    // Format expiry date to match 'yyyy-MM-dd HH:mm:ss'
    const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const formattedExpiryDate = expiryDate.toISOString().replace('T', ' ').substring(0, 19);

    const invoiceData: any = {
      amount,
      customerName: user.name,
      customerEmail: user.email,
      description: paymentDescription,
      invoiceReference: invoiceReference,
      redirectUrl: window.location.origin,
      expiryDate: formattedExpiryDate,
    };
    
    // Add contribution details if making a contribution
    if (contribution) {
      invoiceData.metadata = {
        contributionId: contribution.id,
        contributionName: contribution.name,
        isAnonymous: anonymous
      };
      
      // If we have an account reference for the contribution, include it
      if (contribution.accountReference) {
        console.log(`Using account reference ${contribution.accountReference} for contribution payment`);
        invoiceData.contributionId = contribution.id;
        invoiceData.contributionName = contribution.name;
        invoiceData.contributionAccountReference = contribution.accountReference;
      } else {
        console.warn("No account reference found for contribution:", contribution.id);
      }
    }
    
    console.log("Creating invoice with data:", invoiceData);
    
    // Create invoice
    try {
      const response = await createInvoice(invoiceData);
      
      // Handle different response types
      if ((response as SimpleResponse).success === false) {
        throw new Error((response as SimpleResponse).message);
      }
      
      const apiResponse = response as MonnifyApiResponse;
      if (!apiResponse.responseBody || !apiResponse.responseBody.checkoutUrl) {
        throw new Error("Failed to create payment invoice - missing checkout URL");
      }
      
      // Open checkout in new window
      const checkoutWindow = window.open(apiResponse.responseBody.checkoutUrl, "_blank");
      
      // If window was blocked, show error
      if (!checkoutWindow) {
        toast.error("Please allow pop-ups to complete payment");
        if (onClose) onClose();
        return;
      }
      
      // Create a local transaction record with the correct transaction type
      const transactionData = {
        userId: user.id,
        type: contribution ? "contribution" as const : "deposit" as const,
        amount,
        contributionId: contribution ? contribution.id : "",
        description: paymentDescription,
        status: "pending" as const,
        anonymous: !!anonymous,
        reference: apiResponse.responseBody.invoiceReference || invoiceReference,
        metaData: {
          paymentReference: apiResponse.responseBody.paymentReference,
          invoiceReference: apiResponse.responseBody.invoiceReference,
          contributionId: contribution?.id,
          contributionName: contribution?.name
        }
      };
      
      createTransaction(transactionData);
      
      // Call success callback
      if (onSuccess) {
        onSuccess(apiResponse.responseBody);
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
