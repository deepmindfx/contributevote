
import { createPaymentInvoice } from "@/services/walletIntegration";
import { contributeToGroup } from "@/services/localStorage";
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
