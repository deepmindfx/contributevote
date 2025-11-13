import { supabase } from '@/integrations/supabase/client';

interface InvoiceRequest {
  amount: number;
  customerName: string;
  customerEmail: string;
  paymentReference: string;
  paymentDescription: string;
  currencyCode: string;
  contractCode?: string;
  redirectUrl: string;
}

interface FlutterwavePaymentResponse {
  status: string;
  message: string;
  data: {
    link: string;
  };
}

/**
 * Create a payment invoice using Flutterwave Standard
 */
export const createInvoice = async (data: InvoiceRequest) => {
  try {
    console.log('Calling flutterwave-invoice with data:', data);
    const { data: response, error } = await supabase.functions.invoke('flutterwave-invoice', {
      body: data
    });

    console.log('Flutterwave invoice response:', response);
    console.log('Flutterwave invoice error:', error);

    if (error) {
      console.error('Error calling flutterwave-invoice function:', error);
      return null;
    }

    if (!response?.success || !response?.data?.link) {
      console.error('Invalid response from flutterwave-invoice:', response);
      console.error('Response structure check:', {
        hasSuccess: !!response?.success,
        hasData: !!response?.data,
        hasLink: !!response?.data?.link
      });
      return null;
    }

    // Map Flutterwave response to expected format
    return {
      responseBody: {
        invoiceReference: data.paymentReference,
        paymentDescription: data.paymentDescription,
        amount: data.amount,
        currencyCode: data.currencyCode,
        invoiceStatus: 'PENDING',
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        redirectUrl: data.redirectUrl,
        checkoutUrl: response.data.link,
        createdOn: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error creating invoice:', error);
    return null;
  }
};
