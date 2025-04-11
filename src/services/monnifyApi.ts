
import { toast } from "sonner";

// API Constants
const MONNIFY_BASE_URL = "https://api.monnify.com";
const MONNIFY_API_KEY = "MK_PROD_XR897H4H43";
const MONNIFY_SECRET_KEY = "GPFCA9GTP81DYJGF9VMAPRK220SS6CK9";
const MONNIFY_CONTRACT_CODE = "465595618981";

/**
 * Gets the authentication token from Monnify API
 * @returns Authentication token to be used for subsequent API calls
 */
export const getMonnifyAuthToken = async (): Promise<string> => {
  try {
    const authHeader = `Basic ${btoa(`${MONNIFY_API_KEY}:${MONNIFY_SECRET_KEY}`)}`;
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to get authentication token');
    }
    
    return data.responseBody.accessToken;
  } catch (error) {
    console.error('Error getting Monnify auth token:', error);
    throw error;
  }
};

/**
 * Creates a reserved account for a user
 * @param user User data required for account creation
 * @returns Reserved account details
 */
export const createReservedAccount = async (userData: {
  accountReference: string;
  accountName: string;
  customerEmail: string;
  customerName: string;
  bvn?: string;
}) => {
  try {
    const token = await getMonnifyAuthToken();
    
    const payload = {
      ...userData,
      currencyCode: "NGN",
      contractCode: MONNIFY_CONTRACT_CODE,
      getAllAvailableBanks: true
    };
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v2/bank-transfer/reserved-accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to create reserved account');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error creating reserved account:', error);
    throw error;
  }
};

/**
 * Gets the details of a reserved account
 * @param accountReference The account reference of the reserved account
 * @returns Reserved account details
 */
export const getReservedAccountDetails = async (accountReference: string) => {
  try {
    const token = await getMonnifyAuthToken();
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v2/bank-transfer/reserved-accounts/${accountReference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to get reserved account details');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error getting reserved account details:', error);
    throw error;
  }
};

/**
 * Adds linked accounts to an existing reserved account
 * @param accountReference The account reference of the reserved account
 * @param bankCodes Array of bank codes to link
 * @returns Updated reserved account details
 */
export const addLinkedAccounts = async (accountReference: string, bankCodes: string[]) => {
  try {
    const token = await getMonnifyAuthToken();
    
    const payload = {
      getAllAvailableBanks: false,
      preferredBanks: bankCodes
    };
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/bank-transfer/reserved-accounts/add-linked-accounts/${accountReference}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to add linked accounts');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error adding linked accounts:', error);
    throw error;
  }
};

/**
 * Updates the BVN for a reserved account
 * @param accountReference The account reference of the reserved account
 * @param bvn The BVN to update
 * @returns Updated account details
 */
export const updateBvnForReservedAccount = async (accountReference: string, bvn: string) => {
  try {
    const token = await getMonnifyAuthToken();
    
    const payload = { bvn };
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/bank-transfer/reserved-accounts/update-customer-bvn/${accountReference}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to update BVN');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error updating BVN for reserved account:', error);
    throw error;
  }
};

/**
 * Updates payment source filter for a reserved account
 * @param accountReference The account reference of the reserved account
 * @param restrictPaymentSource Whether to restrict payment sources
 * @param allowedPaymentSources The allowed payment sources
 * @returns Updated account details
 */
export const updateAllowedPaymentSources = async (
  accountReference: string, 
  restrictPaymentSource: boolean,
  allowedPaymentSources: {
    bvns?: string[];
    accountNumbers?: string[];
    accountNames?: string[];
  }
) => {
  try {
    const token = await getMonnifyAuthToken();
    
    const payload = {
      restrictPaymentSource,
      allowedPaymentSources
    };
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/bank-transfer/reserved-accounts/update-payment-source-filter/${accountReference}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to update allowed payment sources');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error updating allowed payment sources:', error);
    throw error;
  }
};

/**
 * Updates income split configuration for a reserved account
 * @param accountReference The account reference of the reserved account
 * @param splitConfig The split configuration
 * @returns Updated account details
 */
export const updateIncomeSplitConfig = async (
  accountReference: string,
  splitConfig: Array<{
    subAccountCode: string;
    feePercentage?: number;
    splitPercentage?: number;
  }>
) => {
  try {
    const token = await getMonnifyAuthToken();
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/bank-transfer/reserved-accounts/update-income-split-config/${accountReference}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(splitConfig)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to update income split configuration');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error updating income split configuration:', error);
    throw error;
  }
};

/**
 * Deallocates a reserved account
 * @param accountReference The account reference of the reserved account
 * @returns Confirmation of deallocation
 */
export const deallocateReservedAccount = async (accountReference: string) => {
  try {
    const token = await getMonnifyAuthToken();
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/bank-transfer/reserved-accounts/reference/${accountReference}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to deallocate reserved account');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error deallocating reserved account:', error);
    throw error;
  }
};

/**
 * Gets reserved account transactions
 * @param accountReference The account reference of the reserved account
 * @param page Page number (starting from 0)
 * @param size Number of records per page
 * @returns Transaction details
 */
export const getReservedAccountTransactions = async (accountReference: string, page = 0, size = 10) => {
  try {
    const token = await getMonnifyAuthToken();
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/bank-transfer/reserved-accounts/transactions?accountReference=${accountReference}&page=${page}&size=${size}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to get reserved account transactions');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error getting reserved account transactions:', error);
    throw error;
  }
};

/**
 * Updates KYC info for a reserved account
 * @param accountReference The account reference of the reserved account
 * @param bvn The BVN to update
 * @returns Updated account details
 */
export const updateKycInfoForReservedAccount = async (accountReference: string, bvn: string) => {
  try {
    const token = await getMonnifyAuthToken();
    
    const payload = { bvn };
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/bank-transfer/reserved-accounts/${accountReference}/kyc-info`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to update KYC info');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error updating KYC info for reserved account:', error);
    throw error;
  }
};

/**
 * Creates an invoice
 * @param invoiceData Invoice data
 * @returns Invoice details
 */
export const createInvoice = async (invoiceData: {
  amount: number;
  invoiceReference: string;
  description: string;
  customerEmail: string;
  customerName: string;
  expiryDate: string;
  accountReference?: string;
  incomeSplitConfig?: Array<{
    subAccountCode: string;
    feePercentage?: number;
    splitAmount?: number;
    feeBearer?: boolean;
  }>;
  redirectUrl?: string;
}) => {
  try {
    const token = await getMonnifyAuthToken();
    
    const payload = {
      ...invoiceData,
      currencyCode: "NGN",
      contractCode: MONNIFY_CONTRACT_CODE
    };
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/invoice/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to create invoice');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
};

/**
 * Gets invoice details
 * @param invoiceReference The invoice reference
 * @returns Invoice details
 */
export const getInvoiceDetails = async (invoiceReference: string) => {
  try {
    const token = await getMonnifyAuthToken();
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/invoice/${invoiceReference}/details`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to get invoice details');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error getting invoice details:', error);
    throw error;
  }
};

/**
 * Lists all invoices
 * @returns List of all invoices
 */
export const listAllInvoices = async () => {
  try {
    const token = await getMonnifyAuthToken();
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/invoice/all`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to list all invoices');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error listing all invoices:', error);
    throw error;
  }
};

/**
 * Cancels an invoice
 * @param invoiceReference The invoice reference
 * @returns Confirmation of cancellation
 */
export const cancelInvoice = async (invoiceReference: string) => {
  try {
    const token = await getMonnifyAuthToken();
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/invoice/${invoiceReference}/cancel`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to cancel invoice');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error canceling invoice:', error);
    throw error;
  }
};

/**
 * Charges a card token
 * @param cardData Card data for charging
 * @returns Charge details
 */
export const chargeCardToken = async (cardData: {
  cardToken: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  paymentReference: string;
  paymentDescription: string;
  metaData?: Record<string, any>;
  incomeSplitConfig?: Array<{
    subAccountCode: string;
    feePercentage?: number;
    splitPercentage?: number;
    splitAmount?: number;
    feeBearer?: boolean;
  }>;
}) => {
  try {
    const token = await getMonnifyAuthToken();
    
    const payload = {
      ...cardData,
      currencyCode: "NGN",
      contractCode: MONNIFY_CONTRACT_CODE,
      apiKey: MONNIFY_API_KEY
    };
    
    const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/merchant/cards/charge-card-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.responseMessage || 'Failed to charge card token');
    }
    
    return data.responseBody;
  } catch (error) {
    console.error('Error charging card token:', error);
    throw error;
  }
};
