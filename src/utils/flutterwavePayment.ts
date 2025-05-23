import { loadScript } from './loadScript';

declare global {
  interface Window {
    FlutterwaveCheckout: any;
  }
}

interface FlutterwaveConfig {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_options: string;
  customer: {
    email: string;
    name: string;
  };
  customizations: {
    title: string;
    description: string;
    logo: string;
  };
  onClose: () => void;
  callback: (response: any) => void;
  meta?: {
    [key: string]: any;
  };
  subaccounts?: any[];
  payment_plan?: string;
  integrity_hash?: string;
  redirect_url?: string;
  design?: {
    logo?: string;
    background?: string;
    button?: string;
  };
}

export const payWithFlutterwave = async (
  amount: number,
  email: string,
  name: string,
  groupName: string,
  onSuccess: (response: any) => void,
  onClose: () => void
) => {
  try {
    // Load Flutterwave script
    await loadScript('https://checkout.flutterwave.com/v3.js');

    // Get the public key from environment variables
    const publicKey = import.meta.env.VITE_FLW_PUBLIC_KEY_PROD;
    if (!publicKey) {
      throw new Error('Flutterwave public key not found in environment variables');
    }

    const config: FlutterwaveConfig = {
      public_key: publicKey,
      tx_ref: `TX-${Date.now()}`,
      amount,
      currency: 'NGN',
      payment_options: 'card,banktransfer,ussd',
      customer: {
        email,
        name,
      },
      customizations: {
        title: 'CollectiPay',
        description: `Contribution to ${groupName}`,
        logo: '/lovable-uploads/85c09632-4fd3-46fb-b70a-45daac74abfc.png',
      },
      meta: {
        source: 'web',
        groupName,
        contributionType: 'direct',
      },
      onClose,
      callback: (response) => {
        console.log('Payment response:', response);
        // Check for successful payment using multiple indicators
        if (
          response.status === 'completed' || 
          response.status === 'successful' ||
          (response.charge_response_code === '00' && response.charge_response_message === 'Approved Successful')
        ) {
          console.log('Payment successful, processing...');
          onSuccess({
            ...response,
            status: 'successful', // Normalize status for our app
            paymentReference: response.tx_ref,
            transactionId: response.transaction_id,
            flutterwaveReference: response.flw_ref,
            chargeResponseCode: response.charge_response_code,
            chargeResponseMessage: response.charge_response_message
          });
        } else {
          console.error('Payment failed:', response);
          onClose();
        }
      },
      design: {
        logo: '/lovable-uploads/85c09632-4fd3-46fb-b70a-45daac74abfc.png',
        background: '#ffffff',
        button: '#2dae75',
      },
    };

    console.log('Initializing Flutterwave with config:', { ...config, public_key: '***' });
    
    // Initialize Flutterwave with error handling
    try {
      window.FlutterwaveCheckout(config);
    } catch (error) {
      console.error('Error initializing Flutterwave checkout:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in payWithFlutterwave:', error);
    throw error;
  }
}; 