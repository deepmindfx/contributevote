
/**
 * Update user's wallet balance
 * @param userId User ID
 * @param amount Amount to add (positive) or subtract (negative)
 * @returns Object indicating success or failure
 */
export const updateUserBalance = (userId: string, amount: number): { success: boolean, message?: string } => {
  try {
    const usersString = localStorage.getItem('users');
    if (!usersString) {
      return {
        success: false,
        message: 'No users found in storage'
      };
    }

    const users = JSON.parse(usersString);
    const userIndex = users.findIndex((u: any) => u.id === userId);
    
    if (userIndex === -1) {
      return {
        success: false,
        message: `User with ID ${userId} not found`
      };
    }

    const user = users[userIndex];
    
    // Initialize walletBalance if it doesn't exist
    if (typeof user.walletBalance === 'undefined') {
      user.walletBalance = 0;
    }
    
    // Ensure we're working with numbers
    const currentBalance = Number(user.walletBalance);
    const amountNumber = Number(amount);
    
    console.log(`Updating balance for user ${userId}: Current=${currentBalance}, Adding=${amountNumber}`);
    
    // For deposit, simply add to the balance
    if (amountNumber >= 0) {
      user.walletBalance = currentBalance + amountNumber;
    } else {
      // For withdrawal, ensure sufficient balance
      if (currentBalance < Math.abs(amountNumber)) {
        return {
          success: false,
          message: 'Insufficient balance'
        };
      }
      user.walletBalance = currentBalance + amountNumber; // amountNumber is negative here
    }
    
    // Update the user in the users array
    users[userIndex] = user;
    
    // Save back to localStorage
    localStorage.setItem('users', JSON.stringify(users));
    
    // If this is the currently logged-in user, update the current user data
    const currentUserString = localStorage.getItem('currentUser');
    if (currentUserString) {
      const currentUser = JSON.parse(currentUserString);
      if (currentUser.id === userId) {
        currentUser.walletBalance = user.walletBalance;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
    
    console.log(`Balance updated successfully: New balance = ${user.walletBalance}`);
    return {
      success: true
    };
  } catch (error) {
    console.error("Error updating user balance:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error updating balance'
    };
  }
};

/**
 * Check if user has contributed to a specific contribution
 * @param userId User ID
 * @param contributionId Contribution ID
 * @returns boolean indicating if user has contributed
 */
export const hasContributed = (userId: string, contributionId: string): boolean => {
  try {
    // Get all transactions
    const transactionsString = localStorage.getItem('transactions');
    if (!transactionsString) return false;
    
    const transactions = JSON.parse(transactionsString);
    
    // Check if there's any transaction where this user contributed to this contribution
    return transactions.some((t: any) => 
      t.userId === userId && 
      t.contributionId === contributionId &&
      t.type === 'deposit' &&
      t.status === 'completed'
    );
  } catch (error) {
    console.error("Error checking if user has contributed:", error);
    return false;
  }
};
