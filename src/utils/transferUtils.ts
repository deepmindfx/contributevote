
import { checkTransferStatus } from "@/services/walletTransfer";

/**
 * Check and update status for any pending transfers
 * Intended to be called when the user loads wallet or transaction history
 */
export const updatePendingTransfers = async () => {
  try {
    // Get all transactions from local storage
    const allTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    
    // Filter out withdrawal transactions that are in pending state
    const pendingTransfers = allTransactions.filter(t => 
      t.type === "withdrawal" && 
      t.status === "pending" && 
      t.metaData && 
      t.metaData.transferReference
    );
    
    // Check status for each pending transfer
    for (const transfer of pendingTransfers) {
      // Check transfer status
      await checkTransferStatus(transfer.metaData.transferReference);
      
      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (error) {
    console.error("Error updating pending transfers:", error);
  }
};
