
import { v4 as uuidv4 } from 'uuid';
import { Transaction } from './types';

export const getReservedAccountTransactions = async (accountReference: string) => {
  try {
    // Get transactions from localStorage for now
    const transactionsStr = localStorage.getItem('transactions');
    const transactions = transactionsStr ? JSON.parse(transactionsStr) : [];
    
    // Filter transactions for this account
    const accountTransactions = transactions.filter((t: Transaction) => 
      t.accountReference === accountReference
    );

    return {
      requestSuccessful: true,
      responseBody: {
        content: accountTransactions
      }
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return {
      requestSuccessful: false,
      responseBody: {
        content: []
      }
    };
  }
};

export const createPaymentInvoice = async (data: {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  userId: string;
}) => {
  try {
    // Create a mock invoice for now
    const invoice = {
      amount: data.amount,
      description: data.description,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      invoiceReference: `INV-${uuidv4()}`,
      checkoutUrl: `#/pay/${uuidv4()}`,
      status: 'PENDING'
    };

    // Store in localStorage
    const invoicesStr = localStorage.getItem('invoices');
    const invoices = invoicesStr ? JSON.parse(invoicesStr) : [];
    invoices.push(invoice);
    localStorage.setItem('invoices', JSON.stringify(invoices));

    return {
      checkoutUrl: invoice.checkoutUrl,
      invoiceReference: invoice.invoiceReference
    };
  } catch (error) {
    console.error('Error creating payment invoice:', error);
    return null;
  }
};

