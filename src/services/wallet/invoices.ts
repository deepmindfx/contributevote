
import { toast } from "sonner";
import * as monnifyApi from "../monnifyApi";
import { getCurrentUser, updateUser, updateUserById } from "../localStorage";
import { InvoiceData } from "./types";

export const createPaymentInvoice = async (data: {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  expiryDate?: string;
  contributionId?: string;
  userId: string;
  redirectUrl?: string;
  contributionAccountReference?: string;
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
      redirectUrl,
      contributionAccountReference
    } = data;
    
    const invoiceReference = `INV_${userId}_${Date.now()}`;
    
    const invoiceData: any = {
      amount,
      invoiceReference,
      description,
      customerEmail,
      customerName,
      currencyCode: "NGN",
      contractCode: "465595618981",
      redirectUrl: redirectUrl || window.location.origin + "/dashboard"
    };
    
    if (expiryDate) {
      invoiceData.expiryDate = expiryDate;
    } else {
      const defaultExpiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      invoiceData.expiryDate = defaultExpiryDate.toISOString().replace('T', ' ').substring(0, 19);
    }
    
    const currentUser = getCurrentUser();
    const allUsers = [currentUser];
    const user = allUsers.find(u => u.id === userId);
    
    if (user?.reservedAccount) {
      Object.assign(invoiceData, { accountReference: user.reservedAccount.accountReference });
    }
    
    const metaData = contributionId ? { contributionId } : undefined;
    if (metaData) {
      Object.assign(invoiceData, { metaData });
    }
    
    if (contributionId && contributionAccountReference) {
      invoiceData.contributionId = contributionId;
      invoiceData.contributionAccountReference = contributionAccountReference;
    }
    
    const result = await monnifyApi.createInvoice(invoiceData);
    
    if (!result?.checkoutUrl) {
      toast.error("Failed to create invoice");
      return null;
    }
    
    if (user) {
      const userInvoices = user.invoices || [];
      const newInvoice: InvoiceData = {
        invoiceReference: result.invoiceReference || invoiceReference,
        description,
        amount,
        currencyCode: "NGN",
        status: "PENDING",
        customerEmail,
        customerName,
        expiryDate: expiryDate || invoiceData.expiryDate,
        redirectUrl: redirectUrl || window.location.origin + "/dashboard",
        checkoutUrl: result.checkoutUrl,
        createdOn: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        contributionId: contributionId || ""
      };
    
      if (userId === currentUser.id) {
        updateUser({ ...currentUser, invoices: [...userInvoices, newInvoice] });
      } else {
        updateUserById(userId, { invoices: [...userInvoices, newInvoice] });
      }
    }
    
    toast.success("Invoice created successfully");
    return result;
  } catch (error) {
    console.error("Error creating invoice:", error);
    toast.error("Failed to create invoice. Please try again.");
    return null;
  }
};
