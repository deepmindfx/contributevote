
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
    
    console.log(`Found ${pendingTransfers.length} pending transfers to check`);
    
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

// Function to check and update group transfers
export const updatePendingGroupContributions = async () => {
  try {
    // Get all transactions from local storage
    const allTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    
    // Filter out contribution transactions that are in pending state 
    // and are related to group contributions via external account
    const pendingContributions = allTransactions.filter(t => 
      t.type === "deposit" && 
      t.status === "pending" && 
      t.metaData && 
      t.metaData.contributionReference
    );
    
    console.log(`Found ${pendingContributions.length} pending group contributions to check`);
    
    // In a real app, we would check each contribution status with Monnify API
    // For now, we'll simulate status updates
    for (const contribution of pendingContributions) {
      // Simulate checking contribution status
      // In a real app, this would call Monnify API to check status
      console.log(`Checking status for contribution: ${contribution.metaData.contributionReference}`);
      
      // Simulate successful contribution (80% chance)
      if (Math.random() > 0.2) {
        // Update transaction status to completed
        contribution.status = "completed";
        
        // Update contribution amount for the group
        const contributions = JSON.parse(localStorage.getItem('contributions') || '[]');
        const contributionIndex = contributions.findIndex(c => c.id === contribution.contributionId);
        
        if (contributionIndex >= 0) {
          contributions[contributionIndex].currentAmount += contribution.amount;
          localStorage.setItem('contributions', JSON.stringify(contributions));
        }
      }
      
      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Save updated transactions
    localStorage.setItem('transactions', JSON.stringify(allTransactions));
    
  } catch (error) {
    console.error("Error updating pending group contributions:", error);
  }
};
