
// First import any required functions from the original file to fix the errors
import { getCurrentUser, getUsers } from "@/services/localStorage";
import { isValid } from "date-fns";
import { ReservedAccountData, CardTokenData } from "@/services/walletIntegration";

// Add the missing function to localStorage.ts
export const verifyUserWithOTP = (userId: string): void => {
  try {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    
    if (index >= 0) {
      users[index].verified = true;
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        currentUser.verified = true;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
  } catch (error) {
    console.error("Error in verifyUserWithOTP:", error);
  }
};

// Add interface for invoice data
export interface InvoiceData {
  invoiceReference: string;
  amount: number;
  description: string;
  currencyCode: string;
  customerEmail: string;
  customerName: string;
  status: string;
  createdAt: string;
  expiryDate: string;
  checkoutUrl?: string;
  contributionId?: string;
}

// Update User interface to include new properties (add to existing interface)
declare module "./localStorage" {
  interface User {
    reservedAccount?: ReservedAccountData;
    cardTokens?: CardTokenData[];
    invoices?: InvoiceData[];
    bvn?: string;
  }
}

// Helper to validate dates
export const validateDate = (dateString: string): boolean => {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    return isValid(date);
  } catch (error) {
    console.error("Error validating date:", error);
    return false;
  }
};
