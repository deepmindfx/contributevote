
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import * as monnifyApi from "../monnifyApi";
import { 
  getCurrentUser, 
  updateUser, 
  updateUserById, 
  addTransaction 
} from "../localStorage";
import { InvoiceData, CardTokenData } from "./types";

/**
 * Creates an invoice for a user or contribution
 * @param data Invoice data
 * @returns Invoice details
 */
export const createPaymentInvoice = async (data: {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  expiryDate?: Date;
  contributionId?: string;
  userId: string;
  redirectUrl?: string;
}): Promise<any> => {
  try {
    const {
      amount,
      description,
      customerEmail,
      customerName,
      expiryDate,
      contributionId,
      userId,
      redirectUrl
    } = data;
    
    // Generate a unique invoice reference
    const invoiceReference = `INV_${userId}_${Date.now()}`;
    
    // Create the invoice data
    const invoiceData: any = {
      amount,
      invoiceReference,
      description,
      customerEmail,
      customerName,
      currencyCode: "NGN",
      contractCode: "465595618981", // Updated with real contract code
      expiryDate: expiryDate ? expiryDate.toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      redirectUrl: redirectUrl || window.location.origin + "/dashboard"
    };
    
    // Get user data to check for reserved account
    const currentUser = getCurrentUser();
    const allUsers = [currentUser]; // In a real app, this would be fetched from a database
    const user = allUsers.find(u => u.id === userId);
    
    // If user has a reserved account, link it to the invoice
    if (user?.reservedAccount) {
      Object.assign(invoiceData, { accountReference: user.reservedAccount.accountReference });
    }
    
    // If this is for a contribution, add it to the metadata
    const metaData = contributionId ? { contributionId } : undefined;
    if (metaData) {
      Object.assign(invoiceData, { metaData });
    }
    
    // Create the invoice
    const result = await monnifyApi.createInvoice(invoiceData);
    
    if (!result || !result.responseBody) {
      toast.error("Failed to create invoice");
      return null;
    }
    
    const responseBody = result.responseBody;
    
    // Store the invoice in the user's data
    const userInvoices = user?.invoices || [];
    const newInvoice: InvoiceData = {
      invoiceReference: responseBody.invoiceReference,
      description: responseBody.description,
      amount: responseBody.amount,
      currencyCode: responseBody.currencyCode,
      status: responseBody.status,
      customerEmail: responseBody.customerEmail,
      customerName: responseBody.customerName,
      expiryDate: responseBody.expiryDate,
      redirectUrl: responseBody.redirectUrl,
      checkoutUrl: responseBody.checkoutUrl,
      createdOn: responseBody.createdOn,
      createdAt: new Date().toISOString(),
      contributionId: contributionId || ""
    };
    
    if (userId === currentUser.id) {
      // Update current user
      updateUser({ 
        ...currentUser, 
        invoices: [...userInvoices, newInvoice] 
      });
    } else {
      // Update other user (admin action)
      updateUserById(userId, { 
        invoices: [...userInvoices, newInvoice] 
      });
    }
    
    toast.success("Invoice created successfully");
    return responseBody;
  } catch (error) {
    console.error("Error creating invoice:", error);
    toast.error("Failed to create invoice. Please try again.");
    return null;
  }
};

/**
 * Saves a card token for a user
 * @param userId The user ID
 * @param cardData Card data to save
 */
export const saveCardToken = async (userId: string, cardData: CardTokenData): Promise<boolean> => {
  try {
    const currentUser = getCurrentUser();
    const allUsers = [currentUser]; // In a real app, this would be fetched from a database
    const user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      toast.error("User not found");
      return false;
    }
    
    // Save card token to user data
    const userCards = user.cardTokens || [];
    
    // Check if card already exists
    const existingCardIndex = userCards.findIndex(
      card => card.lastFourDigits === cardData.lastFourDigits
    );
    
    if (existingCardIndex >= 0) {
      // Update existing card
      userCards[existingCardIndex] = cardData;
    } else {
      // Add new card
      userCards.push(cardData);
    }
    
    // Update user data
    if (userId === currentUser.id) {
      updateUser({
        ...currentUser,
        cardTokens: userCards
      });
    } else {
      updateUserById(userId, {
        cardTokens: userCards
      });
    }
    
    toast.success("Card saved successfully");
    return true;
  } catch (error) {
    console.error("Error saving card token:", error);
    toast.error("Failed to save card. Please try again.");
    return false;
  }
};

/**
 * Charges a saved card
 * @param userId The user ID
 * @param cardToken The card token
 * @param amount The amount to charge
 * @param description Payment description
 * @param contributionId Optional contribution ID if this is for a contribution
 */
export const chargeSavedCard = async (
  userId: string,
  cardToken: string,
  amount: number,
  description: string,
  contributionId?: string
): Promise<boolean> => {
  try {
    const currentUser = getCurrentUser();
    const allUsers = [currentUser]; // In a real app, this would be fetched from a database
    const user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      toast.error("User not found");
      return false;
    }
    
    // Generate a unique payment reference
    const paymentReference = `PAY_${userId}_${Date.now()}`;
    
    // Set up metadata
    const metaData: Record<string, any> = {
      userId
    };
    
    if (contributionId) {
      metaData.contributionId = contributionId;
    }
    
    // Charge the card
    const result = await monnifyApi.chargeCardToken({
      cardToken,
      amount,
      customerName: user.name || `${user.firstName} ${user.lastName}`,
      customerEmail: user.email,
      paymentReference,
      paymentDescription: description,
      currencyCode: "NGN",
      contractCode: "465595618981", // Updated with real contract code
      metaData
    });
    
    if (!result || !result.responseBody) {
      toast.error("Failed to charge card");
      return false;
    }
    
    const responseBody = result.responseBody;
    
    // Process the payment
    if (responseBody.paymentStatus === "PAID") {
      if (contributionId) {
        // Process as a contribution payment
        console.log("Processing contribution payment:", contributionId, amount);
        
        // You would call your existing contribution logic here
        // For example:
        // contributeToGroup(contributionId, amount);
      } else {
        // Process as a wallet top-up
        // Add transaction record
        addTransaction({
          id: responseBody.transactionReference,
          userId,
          type: "deposit" as "deposit" | "withdrawal" | "transfer" | "vote",
          amount,
          contributionId: "",
          description: description || "Wallet top-up via card",
          status: "completed" as "completed" | "pending" | "failed",
          createdAt: new Date().toISOString(),
          metaData: {
            paymentReference,
            cardType: responseBody.cardType
          }
        });
        
        // Update user's wallet balance
        if (userId === currentUser.id) {
          updateUser({
            ...currentUser,
            walletBalance: (currentUser.walletBalance || 0) + amount
          });
        } else {
          // Admin action for other user
          updateUserById(userId, {
            walletBalance: (currentUser.walletBalance || 0) + amount
          });
        }
      }
      
      toast.success(`Card charged successfully: ₦${amount.toLocaleString()}`);
      return true;
    } else {
      toast.error(`Payment failed: ${responseBody.paymentStatus}`);
      return false;
    }
  } catch (error) {
    console.error("Error charging card:", error);
    toast.error("Failed to charge card. Please try again.");
    return false;
  }
};
