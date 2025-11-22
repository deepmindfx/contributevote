
import { toast } from "sonner";
import * as monnifyApi from "../monnifyApi";
import { 
  User, 
  updateUser, 
  getCurrentUser, 
  updateUserById 
} from "../localStorage";
import { ReservedAccountData } from "./types";

export const createUserReservedAccount = async (
  userId: string, 
  idType?: string, 
  idNumber?: string
): Promise<ReservedAccountData | null> => {
  try {
    // Get current user data
    const currentUser = getCurrentUser();
    const allUsers = [currentUser];
    const user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      toast.error("User not found");
      return null;
    }
    
    // Check if user already has a reserved account
    if (user.reservedAccount) {
      toast.info("User already has a reserved account");
      return user.reservedAccount;
    }
    
    // Validate ID information
    if (!idType || !idNumber) {
      toast.error("BVN is required to create a virtual account");
      return null;
    }
    
    // Create a unique account reference
    const accountReference = `COLL_${userId}_${Date.now()}`;
    
    // Create the API request object
    const requestBody: any = {
      accountReference,
      accountName: user.name || `${user.firstName} ${user.lastName}`,
      customerEmail: user.email,
      customerName: user.name || `${user.firstName} ${user.lastName}`,
      currencyCode: "NGN",
      contractCode: "465595618981",
      getAllAvailableBanks: true
    };
    
    if (idType === "bvn") {
      requestBody.bvn = idNumber;
    } else if (idType === "nin") {
      requestBody.nin = idNumber;
    }
    
    const result = await monnifyApi.createReservedAccount(requestBody);
    
    if (!result || !result.responseBody) {
      if (result && !result.success) {
        toast.error(result.message || "Failed to create reserved account");
      } else {
        toast.error("Failed to create reserved account");
      }
      return null;
    }
    
    const responseBody = result.responseBody;
    const reservedAccount: ReservedAccountData = {
      accountReference: responseBody.accountReference,
      accountName: responseBody.accountName,
      accountNumber: responseBody.accounts?.[0]?.accountNumber || "",
      bankName: responseBody.accounts?.[0]?.bankName || "",
      bankCode: responseBody.accounts?.[0]?.bankCode || "",
      reservationReference: responseBody.reservationReference,
      status: responseBody.status,
      createdOn: responseBody.createdOn,
      accounts: responseBody.accounts?.map(acc => ({
        bankCode: acc.bankCode,
        bankName: acc.bankName,
        accountNumber: acc.accountNumber
      }))
    };
    
    // Update user with reserved account data
    if (userId === currentUser.id) {
      updateUser({ ...currentUser, reservedAccount });
    } else {
      updateUserById(userId, { reservedAccount });
    }
    
    toast.success("Reserved account created successfully");
    return reservedAccount;
  } catch (error) {
    console.error("Error creating reserved account:", error);
    toast.error("Failed to create reserved account. Please try again.");
    return null;
  }
};

export const getUserReservedAccount = async (userId: string): Promise<ReservedAccountData | null> => {
  try {
    const currentUser = getCurrentUser();
    const allUsers = [currentUser];
    const user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      toast.error("User not found");
      return null;
    }
    
    if (!user.reservedAccount?.accountReference) {
      toast.info("User doesn't have a reserved account");
      return null;
    }
    
    const result = await monnifyApi.getReservedAccountDetails(user.reservedAccount.accountReference);
    
    if (!result?.responseBody) {
      toast.error("Failed to get reserved account details");
      return user.reservedAccount;
    }
    
    const responseBody = result.responseBody;
    const reservedAccount: ReservedAccountData = {
      accountReference: responseBody.accountReference,
      accountName: responseBody.accountName,
      accountNumber: responseBody.accounts?.[0]?.accountNumber || "",
      bankName: responseBody.accounts?.[0]?.bankName || "",
      bankCode: responseBody.accounts?.[0]?.bankCode || "",
      reservationReference: responseBody.reservationReference,
      status: responseBody.status,
      createdOn: responseBody.createdOn,
      accounts: responseBody.accounts?.map(acc => ({
        bankCode: acc.bankCode,
        bankName: acc.bankName,
        accountNumber: acc.accountNumber
      }))
    };
    
    if (userId === currentUser.id) {
      updateUser({ ...currentUser, reservedAccount });
    } else {
      updateUserById(userId, { reservedAccount });
    }
    
    return reservedAccount;
  } catch (error) {
    console.error("Error getting reserved account:", error);
    toast.error("Failed to get reserved account details. Please try again.");
    
    const currentUser = getCurrentUser();
    const allUsers = [currentUser];
    const user = allUsers.find(u => u.id === userId);
    
    return user?.reservedAccount || null;
  }
};
