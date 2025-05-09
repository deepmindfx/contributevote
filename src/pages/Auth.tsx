
import AuthForm from "@/components/auth/AuthForm";
import Header from "@/components/layout/Header";
import { useEffect, useState } from "react";
import { AppContext, useApp } from "@/contexts/AppContext";
import { useUser } from "@/contexts/UserContext";
import { useContribution } from "@/contexts/ContributionContext";
import { ensureAccountNumberDisplay } from "@/localStorage";
import { initializeLocalStorage } from "@/services/localStorage";

const Auth = () => {
  // Get context values from their respective providers
  const { 
    user, 
    users, 
    isAdmin, 
    isAuthenticated, 
    refreshUserData,
    updateProfile,
    updateUserAsAdmin,
    depositToUserAsAdmin,
    pauseUserAsAdmin,
    activateUserAsAdmin,
    getUserByEmail,
    getUserByPhone,
    verifyUser,
    logout
  } = useUser();

  const {
    contributions,
    withdrawalRequests,
    transactions,
    stats,
    refreshContributionData,
    createNewContribution,
    contribute,
    contributeViaAccountNumber,
    requestWithdrawal,
    vote,
    getShareLink,
    shareToContacts,
    pingMembersForVote,
    getReceipt,
    isGroupCreator
  } = useContribution();

  // Initialize local storage when the auth page loads
  useEffect(() => {
    try {
      initializeLocalStorage();
      refreshUserData();
      
      if (isAuthenticated && user?.id) {
        refreshContributionData();
      }
      
      // Ensure account numbers are displayed
      try {
        ensureAccountNumberDisplay();
      } catch (error) {
        console.info("Non-critical error in ensureAccountNumberDisplay:", error);
      }
    } catch (error) {
      console.error("Error initializing Auth page:", error);
    }
  }, []);

  // Combine all refresh functions into one
  const refreshData = () => {
    try {
      initializeLocalStorage();
      refreshUserData();
      
      if (isAuthenticated && user?.id) {
        refreshContributionData();
      }
      
      try {
        ensureAccountNumberDisplay();
      } catch (error) {
        console.info("Non-critical error in ensureAccountNumberDisplay:", error);
      }
    } catch (error) {
      console.error("Error in refreshData:", error);
    }
  };

  // Create the app context value to provide to Header and AuthForm
  const appContextValue = {
    user,
    users,
    contributions,
    withdrawalRequests,
    transactions,
    stats,
    refreshData,
    createNewContribution,
    contribute,
    contributeViaAccountNumber,
    requestWithdrawal,
    vote,
    getShareLink,
    updateProfile,
    updateUserAsAdmin,
    depositToUserAsAdmin,
    pauseUserAsAdmin,
    activateUserAsAdmin,
    isAdmin,
    isAuthenticated,
    shareToContacts,
    logout,
    getUserByEmail,
    getUserByPhone,
    pingMembersForVote,
    getReceipt,
    verifyUser,
    isGroupCreator,
  };

  return (
    <AppContext.Provider value={appContextValue}>
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-4 pt-16 pb-32">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight">Welcome to CollectiPay</h2>
              <p className="text-muted-foreground mt-2">
                Secure login for your group contribution platform
              </p>
            </div>
            <AuthForm />
          </div>
        </div>
      </div>
    </AppContext.Provider>
  );
};

export default Auth;
