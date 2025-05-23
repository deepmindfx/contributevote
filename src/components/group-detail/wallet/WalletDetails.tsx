
import React from "react";
import { format, isValid } from "date-fns";
import { Contribution } from "@/services/localStorage";
import AccountNumberDisplay from "@/components/contributions/AccountNumberDisplay";

interface WalletDetailsProps {
  contribution: Contribution;
}

const WalletDetails = ({ contribution }: WalletDetailsProps) => {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (!isValid(date)) {
        return "Invalid date";
      }
      return format(date, 'MMMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
      {/* Account Number Display */}
      {contribution && (
        <AccountNumberDisplay 
          accountNumber={contribution.accountNumber || ''} 
          accountName={contribution.name || ''}
          monnifyDetails={contribution.accountDetails}
        />
      )}
      
      <div className="space-y-2">
        <span className="text-sm font-medium">Group Details</span>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Frequency</span>
          <span className="capitalize">{contribution?.frequency}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Members</span>
          <span>{contribution?.members.length}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Started</span>
          <span>{formatDate(contribution?.startDate)}</span>
        </div>
      </div>
    </div>
  );
};

export default WalletDetails;
