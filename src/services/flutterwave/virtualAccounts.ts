
import { PUBLIC_KEY, SECRET_KEY, BASE_URL } from './config';

/**
 * Create a virtual account with Flutterwave
 * @param data Request data
 */
export const createVirtualAccount = async (data: any) => {
  try {
    const response = await fetch(`${BASE_URL}/virtual-account-numbers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Error creating virtual account:', responseData);
      return {
        success: false,
        message: responseData.message || 'Failed to create virtual account',
        responseBody: null
      };
    }

    return {
      success: true,
      message: 'Virtual account created successfully',
      responseBody: responseData.data
    };
  } catch (error) {
    console.error('Error creating virtual account:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      responseBody: null
    };
  }
};

/**
 * Create a group virtual account with Flutterwave
 * @param data Request data
 */
export const createGroupVirtualAccount = async (data: any) => {
  try {
    const response = await fetch(`${BASE_URL}/virtual-account-numbers/bulk`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Error creating group virtual account:', responseData);
      return {
        success: false,
        message: responseData.message || 'Failed to create group virtual account',
        responseBody: null
      };
    }

    return {
      success: true,
      message: 'Group virtual account created successfully',
      responseBody: responseData.data
    };
  } catch (error) {
    console.error('Error creating group virtual account:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      responseBody: null
    };
  }
};

/**
 * Get transactions for a reserved account
 * @param accountReference The account reference
 */
export const getReservedAccountTransactions = async (accountReference: string) => {
  try {
    const response = await fetch(`${BASE_URL}/virtual-account-numbers/${accountReference}/transactions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Error getting reserved account transactions:', responseData);
      return {
        success: false,
        message: responseData.message || 'Failed to get reserved account transactions',
        responseBody: null
      };
    }

    return {
      success: true,
      message: 'Reserved account transactions retrieved successfully',
      responseBody: responseData.data
    };
  } catch (error) {
    console.error('Error getting reserved account transactions:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      responseBody: null
    };
  }
};

/**
 * Get details for a reserved account
 * @param accountReference The account reference
 */
export const getReservedAccountDetails = async (accountReference: string) => {
  try {
    const response = await fetch(`${BASE_URL}/virtual-account-numbers/${accountReference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Error getting reserved account details:', responseData);
      return {
        success: false,
        message: responseData.message || 'Failed to get reserved account details',
        responseBody: null
      };
    }

    return {
      success: true,
      message: 'Reserved account details retrieved successfully',
      responseBody: responseData.data
    };
  } catch (error) {
    console.error('Error getting reserved account details:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      responseBody: null
    };
  }
};

/**
 * Create an invoice for payment
 * @param data The invoice data
 */
export const createInvoice = async (data: any) => {
  try {
    const response = await fetch(`${BASE_URL}/payment-invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Error creating payment invoice:', responseData);
      return {
        success: false,
        message: responseData.message || 'Failed to create payment invoice',
        responseBody: null
      };
    }

    return {
      success: true,
      message: 'Payment invoice created successfully',
      responseBody: responseData.data
    };
  } catch (error) {
    console.error('Error creating payment invoice:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      responseBody: null
    };
  }
};

// Re-export the verifyTransaction function from transactions.ts
export { verifyTransaction } from './transactions';
