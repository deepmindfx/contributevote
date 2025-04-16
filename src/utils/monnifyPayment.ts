
import { createTransaction } from "@/services/localStorage/transactionOperations";
import { updateContribution } from "@/services/localStorage/contributionOperations";
import { toast } from "sonner";
import { getContributionById } from "@/services/localStorage/contributionOperations";
import { createDirectPayment } from "@/services/monnifyApi";

// Declare Monnify SDK global type
declare global {
  interface Window {
    MonnifySDK: any;
  }
}

interface MonnifyPaymentProps {
  amount: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
  contribution: {
    id: string;
    name: string;
    accountNumber?: string;
    accountDetails?: any;
  };
  anonymous: boolean;
  onSuccess?: (response: any) => void;
  onClose?: () => void;
}

export function initMonnifyScript(): Promise<boolean> {
  return new Promise((resolve) => {
    // Check if script is already loaded
    if (window.MonnifySDK) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://sdk.monnify.com/plugin/monnify.js';
    script.async = true;
    
    script.onload = () => {
      console.log("Monnify SDK loaded successfully");
      resolve(true);
    };
    
    script.onerror = () => {
      console.error('Failed to load Monnify SDK');
      resolve(false);
    };
    
    document.body.appendChild(script);
  });
}

export async function payWithMonnify({
  amount,
  user,
  contribution,
  anonymous,
  onSuccess,
  onClose
}: MonnifyPaymentProps) {
  // Generate unique transaction reference
  const reference = `CONTRIB_${contribution.id}_${Date.now()}`;
  
  console.log("Initializing Monnify payment with:", {
    amount, reference, name: user.name, email: user.email, contributionId: contribution.id, anonymous
  });
  
  // Get the full contribution details to check if we have an account reference
  const contributionDetail = getContributionById(contribution.id);
  
  if (contributionDetail?.accountDetails?.accountReference) {
    try {
      // Use direct payment to the group's account if available
      const response = await createDirectPayment({
        amount: amount,
        customerName: user.name,
        customerEmail: user.email,
        paymentDescription: `Contribution to ${contribution.name}`,
        paymentReference: reference,
        accountReference: contributionDetail.accountDetails.accountReference,
        metadata: {
          userId: user.id,
          contributionId: contribution.id,
          device: "web",
          anonymous: anonymous
        }
      });
      
      if (response.requestSuccessful) {
        console.log("Direct payment initialized successfully", response);
        
        // Open the checkout URL
        window.open(response.responseBody.checkoutUrl, "_blank");
        
        // Register the pending payment
        registerPendingPayment(reference, amount, user, contribution, anonymous);
        
        if (onSuccess) {
          onSuccess(response.responseBody);
        }
        
        return;
      } else {
        console.error("Direct payment initialization failed", response);
        toast.error("Payment initialization failed. Falling back to generic payment.");
        // Fall back to generic payment
      }
    } catch (error) {
      console.error("Error with direct payment:", error);
      toast.error("Direct payment failed. Falling back to generic payment.");
      // Fall back to generic payment
    }
  }
  
  // Fallback to the generic payment if direct payment failed or no account reference
  // Ensure the script is loaded
  const isLoaded = await initMonnifyScript();
  if (!isLoaded) {
    console.error('Monnify SDK failed to load');
    toast.error("Payment initialization failed. Please try again.");
    return;
  }
  
  // Initialize payment
  window.MonnifySDK.initialize({
    amount: amount,
    currency: "NGN",
    reference: reference,
    customerFullName: user.name,
    customerEmail: user.email,
    apiKey: "MK_PROD_XR897H4H43",
    contractCode: "465595618981",
    paymentDescription: `Contribution to ${contribution.name}`,
    metadata: {
      userId: user.id,
      contributionId: contribution.id,
      device: "web",
      anonymous: anonymous
    },
    paymentMethods: ["CARD", "ACCOUNT_TRANSFER", "USSD", "PHONE_NUMBER"],
    onComplete: function(response: any) {
      console.log("Monnify payment complete:", response);
      
      if (response.status === "SUCCESS") {
        // Record the successful payment
        recordSuccessfulPayment(response, amount, user, contribution, anonymous);
        
        if (onSuccess) {
          onSuccess(response);
        }
      } else {
        toast.error("Payment was not successful");
      }
    },
    onClose: function(data: any) {
      console.log("User closed payment modal", data);
      if (onClose) {
        onClose();
      }
    }
  });
}

function registerPendingPayment(reference: string, amount: number, user: any, contribution: any, anonymous: boolean) {
  // Create a pending transaction record
  createTransaction({
    contributionId: contribution.id,
    userId: user.id,
    type: "deposit",
    amount: amount,
    description: `Pending contribution to ${contribution.name}`,
    status: "pending",
    reference: reference,
    paymentMethod: "Card/Bank Transfer",
    metaData: {
      contributorName: anonymous ? "Anonymous" : user.name,
      senderName: anonymous ? "Anonymous" : user.name,
      anonymous: anonymous,
      pendingWebhookConfirmation: true
    },
    anonymous: anonymous
  });
  
  toast.success("Payment initiated! Your contribution will be recorded once payment is completed.");
}

function recordSuccessfulPayment(response: any, amount: number, user: any, contribution: any, anonymous: boolean) {
  // Create transaction record
  createTransaction({
    contributionId: contribution.id,
    userId: user.id,
    type: "deposit",
    amount: response.amount,
    description: `Contribution to ${contribution.name} via ${response.paymentMethod}`,
    status: "successful",
    reference: response.transactionReference,
    paymentMethod: response.paymentMethod,
    metaData: {
      ...response,
      contributorName: anonymous ? "Anonymous" : user.name,
      senderName: anonymous ? "Anonymous" : user.name,
      anonymous: anonymous
    },
    anonymous: anonymous
  });
  
  // Update contribution amount
  const contributionDetail = getContributionById(contribution.id);
  if (contributionDetail) {
    updateContribution(contribution.id, {
      currentAmount: contributionDetail.currentAmount + response.amount,
      contributors: [
        ...contributionDetail.contributors,
        {
          userId: user.id,
          name: anonymous ? "Anonymous" : user.name,
          amount: response.amount,
          date: new Date().toISOString(),
          anonymous: anonymous,
        }
      ]
    });
  }
  
  toast.success("Payment successful! Your contribution has been recorded.");
}
