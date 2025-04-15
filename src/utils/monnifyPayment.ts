
import { createTransaction } from "@/services/localStorage/transactionOperations";
import { updateContribution } from "@/services/localStorage/contributionOperations";
import { toast } from "sonner";

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
  };
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
  onSuccess,
  onClose
}: MonnifyPaymentProps) {
  // Ensure the script is loaded
  const isLoaded = await initMonnifyScript();
  if (!isLoaded) {
    console.error('Monnify SDK failed to load');
    toast.error("Payment initialization failed. Please try again.");
    return;
  }

  // Show amount input dialog if amount is 0
  if (amount <= 0) {
    const contributionAmount = prompt("Enter contribution amount (NGN):");
    if (!contributionAmount || isNaN(Number(contributionAmount)) || Number(contributionAmount) <= 0) {
      toast.error("Please enter a valid amount");
      if (onClose) onClose();
      return;
    }
    amount = Number(contributionAmount);
  }

  // Generate unique transaction reference
  const reference = `CONTRIB_${contribution.id}_${Date.now()}`;
  
  console.log("Initializing Monnify payment with:", {
    amount, reference, name: user.name, email: user.email, contributionId: contribution.id
  });
  
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
      anonymous: false
    },
    paymentMethods: ["CARD", "ACCOUNT_TRANSFER", "USSD", "PHONE_NUMBER"],
    onComplete: function(response: any) {
      console.log("Monnify payment complete:", response);
      
      if (response.status === "SUCCESS") {
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
            contributorName: user.name
          }
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
                amount: response.amount,
                date: new Date().toISOString(),
                anonymous: false,
              }
            ]
          });
        }
        
        // Call onSuccess callback if provided
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

function getContributionById(contributionId: string) {
  const contributionsString = localStorage.getItem('contributions');
  if (!contributionsString) return null;
  
  const contributions = JSON.parse(contributionsString);
  return contributions.find((c: any) => c.id === contributionId) || null;
}
