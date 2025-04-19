
import { createPaymentInvoice } from "@/services/walletIntegration";
import { contributeToGroup } from "@/services/localStorage";
import { createTransaction } from "@/services/localStorage/transactionOperations";
import { toast } from "sonner";

interface MonnifyPaymentProps {
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
}: MonnifyPaymentProps) => {
  try {
    // Create payload with appropriate references
    let payload: any = {
      amount: amount,
      customerName: user.name,
      customerEmail: user.email,
      userId: user.id,
      description: contribution 
        ? `Contribution to ${contribution.name}` 
        : "Wallet top-up",
    };
    
    // If contribution details are provided, include them in the payload
    if (contribution && contribution.id) {
      payload.contributionId = contribution.id;
      payload.contributionName = contribution.name;
      payload.anonymous = anonymous;
      
      // Include contribution account reference if available
      if (contribution.accountReference) {
        payload.contributionAccountReference = contribution.accountReference;
        console.log("Using contribution account reference:", contribution.accountReference);
      }
    }
    
    // Add expiryDate formatted as yyyy-MM-dd HH:mm:ss (24 hours from now)
    const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const formattedExpiryDate = expiryDate.toISOString().replace('T', ' ').substring(0, 19);
    payload.expiryDate = formattedExpiryDate;
    
    console.log("Creating payment with payload:", payload);
    
    try {
      // Create the payment invoice
      const result = await createPaymentInvoice(payload);
      
      if (!result || !result.checkoutUrl) {
        console.error("Failed to create payment invoice:", result);
        toast.error("Failed to create payment invoice. Please try again.");
        if (onClose) onClose();
        return null;
      }
      
      // Create a local transaction record to track the payment
      if (contribution && contribution.id) {
        createTransaction({
          userId: user.id,
          type: "payment",
          amount: amount,
          contributionId: contribution.id,
          description: `Card payment for ${contribution.name}`,
          status: "pending",
          anonymous: anonymous || false,
          reference: result.invoiceReference,
          metaData: {
            paymentReference: result.paymentReference,
            invoiceReference: result.invoiceReference,
            contributionId: contribution.id,
            contributionName: contribution.name
          }
        });
      }
      
      // For debugging purposes
      console.log("Payment invoice created:", result);
      
      // Open the checkout URL in a new window
      const checkoutWindow = window.open(result.checkoutUrl, "_blank");
      
      // Set up a polling mechanism to check for payment completion
      const checkPaymentStatus = setInterval(() => {
        if (checkoutWindow && checkoutWindow.closed) {
          clearInterval(checkPaymentStatus);
          
          // Call the onClose callback when the window is closed
          if (onClose) {
            onClose();
          }
        }
      }, 1000);
      
      // Return the result for further processing if needed
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (error) {
      console.error("Error creating payment invoice:", error);
      toast.error("Failed to create payment invoice. Please try again.");
      if (onClose) onClose();
      return null;
    }
  } catch (error) {
    console.error("Error in payWithMonnify:", error);
    toast.error("Payment processing failed. Please try again.");
    if (onClose) onClose();
    return null;
  }
};
