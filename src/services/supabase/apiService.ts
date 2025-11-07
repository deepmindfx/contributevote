import { supabase } from '@/integrations/supabase/client';

export class SupabaseApiService {
  private static getEdgeFunctionUrl(functionName: string): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qnkezzhrhbosekxhfqzo.supabase.co';
    return `${supabaseUrl}/functions/v1/${functionName}`;
  }

  // Get Nigerian banks
  static async getBanks() {
    try {
      const { data, error } = await supabase.functions.invoke('flutterwave-banks', {
        method: 'GET'
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching banks:', error);
      throw error;
    }
  }

  // Resolve bank account
  static async resolveAccount(bankCode: string, accountNumber: string) {
    try {
      const { data, error } = await supabase.functions.invoke('flutterwave-resolve-account', {
        method: 'GET',
        body: new URLSearchParams({
          bankCode,
          accountNumber
        })
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error resolving account:', error);
      throw error;
    }
  }

  // Process transfer
  static async processTransfer(transferData: {
    amount: number;
    accountNumber: string;
    bankCode: string;
    beneficiaryName: string;
    currency: string;
    narration?: string;
  }) {
    try {
      const { data, error } = await supabase.functions.invoke('flutterwave-transfer', {
        method: 'POST',
        body: transferData
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error processing transfer:', error);
      throw error;
    }
  }

  // Send contribution webhook (for testing)
  static async sendContributionWebhook(webhookData: {
    type: string;
    data: {
      accountNumber: string;
      amount: number;
      senderName?: string;
      bankName?: string;
      paymentReference?: string;
    };
  }) {
    try {
      const { data, error } = await supabase.functions.invoke('webhook-contribution', {
        method: 'POST',
        body: webhookData
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error sending contribution webhook:', error);
      throw error;
    }
  }

  // Simulate contribution transfer (for testing)
  static async simulateContributionTransfer(
    accountNumber: string,
    amount: number,
    senderName?: string,
    bankName?: string
  ) {
    const paymentReference = `sim_tx_${Date.now()}`;
    
    // Simulate a webhook call after a delay
    setTimeout(async () => {
      try {
        await this.sendContributionWebhook({
          type: 'contribution_received',
          data: {
            accountNumber,
            amount,
            senderName: senderName || 'Test Sender',
            bankName: bankName || 'Test Bank',
            paymentReference,
          }
        });
        console.log('Simulated webhook sent successfully');
      } catch (error) {
        console.error('Error sending simulated webhook:', error);
      }
    }, 2000);

    return {
      success: true,
      message: 'Simulated transfer initiated',
      data: {
        accountNumber,
        amount,
        paymentReference
      }
    };
  }
}

// Legacy API service for backward compatibility
export class LegacyApiService {
  private static baseUrl = 'http://localhost:5000/api';

  static async getBanks() {
    const response = await fetch(`${this.baseUrl}/banks`);
    if (!response.ok) throw new Error('Failed to fetch banks');
    return response.json();
  }

  static async resolveAccount(bankCode: string, accountNumber: string) {
    const response = await fetch(
      `${this.baseUrl}/resolve-account?bankCode=${bankCode}&accountNumber=${accountNumber}`
    );
    if (!response.ok) throw new Error('Failed to resolve account');
    return response.json();
  }

  static async processTransfer(transferData: any) {
    const response = await fetch(`${this.baseUrl}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transferData)
    });
    if (!response.ok) throw new Error('Failed to process transfer');
    return response.json();
  }
}

// Main API service that can switch between Supabase and Legacy
export class ApiService {
  private static useSupabase = import.meta.env.VITE_USE_SUPABASE === 'true';

  static async getBanks() {
    if (this.useSupabase) {
      return SupabaseApiService.getBanks();
    } else {
      return LegacyApiService.getBanks();
    }
  }

  static async resolveAccount(bankCode: string, accountNumber: string) {
    if (this.useSupabase) {
      return SupabaseApiService.resolveAccount(bankCode, accountNumber);
    } else {
      return LegacyApiService.resolveAccount(bankCode, accountNumber);
    }
  }

  static async processTransfer(transferData: any) {
    if (this.useSupabase) {
      return SupabaseApiService.processTransfer(transferData);
    } else {
      return LegacyApiService.processTransfer(transferData);
    }
  }

  static async simulateContributionTransfer(
    accountNumber: string,
    amount: number,
    senderName?: string,
    bankName?: string
  ) {
    if (this.useSupabase) {
      return SupabaseApiService.simulateContributionTransfer(accountNumber, amount, senderName, bankName);
    } else {
      // Legacy simulation
      const response = await fetch('http://localhost:5000/api/simulate-contribution-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, amount, senderName, bankName })
      });
      if (!response.ok) throw new Error('Failed to simulate transfer');
      return response.json();
    }
  }
}