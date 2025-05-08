
import { toast } from "sonner";
import * as monnifyApi from "../monnifyApi";
import { getCurrentUser, updateUser, updateUserById, addTransaction } from "../localStorage";
import { CardTokenData } from "./types";

export const saveCardToken = async (userId: string, cardData: CardTokenData): Promise<boolean> => {
  try {
    const currentUser = getCurrentUser();
    const allUsers = [currentUser];
    const user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      toast.error("User not found");
      return false;
    }
    
    const userCards = user.cardTokens || [];
    const existingCardIndex = userCards.findIndex(
      card => card.lastFourDigits === cardData.lastFourDigits
    );
    
    if (existingCardIndex >= 0) {
      userCards[existingCardIndex] = cardData;
    } else {
      userCards.push(cardData);
    }
    
    if (userId === currentUser.id) {
      updateUser({ ...currentUser, cardTokens: userCards });
    } else {
      updateUserById(userId, { cardTokens: userCards });
    }
    
    toast.success("Card saved successfully");
    return true;
  } catch (error) {
    console.error("Error saving card token:", error);
    toast.error("Failed to save card. Please try again.");
    return false;
  }
};

export const chargeSavedCard = async (
  userId: string,
  cardToken: string,
  amount: number,
  description: string,
  contributionId?: string
): Promise<boolean> => {
  try {
    const currentUser = getCurrentUser();
    const allUsers = [currentUser];
    const user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      toast.error("User not found");
      return false;
    }
    
    const paymentReference = `PAY_${userId}_${Date.now()}`;
    const metaData: Record<string, any> = { userId };
    
    if (contributionId) {
      metaData.contributionId = contributionId;
    }
    
    const result = await monnifyApi.chargeCardToken({
      cardToken,
      amount,
      customerName: user.name || `${user.firstName} ${user.lastName}`,
      customerEmail: user.email,
      paymentReference,
      paymentDescription: description,
      currencyCode: "NGN",
      contractCode: "465595618981",
      metaData
    });
    
    if (!result?.responseBody) {
      toast.error("Failed to charge card");
      return false;
    }
    
    const responseBody = result.responseBody;
    
    if (responseBody.paymentStatus === "PAID") {
      if (!contributionId) {
        addTransaction({
          id: responseBody.transactionReference,
          userId,
          type: "deposit",
          amount,
          contributionId: "",
          description: description || "Wallet top-up via card",
          status: "completed",
          createdAt: new Date().toISOString(),
          metaData: {
            paymentReference,
            cardType: responseBody.cardType
          }
        });
        
        if (userId === currentUser.id) {
          updateUser({
            ...currentUser,
            walletBalance: (currentUser.walletBalance || 0) + amount
          });
        } else {
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
