
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Contribution } from "@/services/localStorage";

interface WalletHeaderProps {
  contribution: Contribution;
  progressPercentage: number;
}

const WalletHeader = ({ contribution, progressPercentage }: WalletHeaderProps) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <img 
            src="/lovable-uploads/e42496b1-7582-432a-8a35-d596e573ab7d.png" 
            alt="CollectiPay Logo" 
            className="h-8 w-8"
          />
        </div>
        <div>
          <h3 className="font-medium text-lg">Group Wallet</h3>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">CollectiPay</p>
            <Badge variant="outline" className="text-xs">
              {contribution?.category}
            </Badge>
          </div>
        </div>
      </div>
      
      <div className="text-center md:text-right">
        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
          ₦{contribution?.currentAmount.toLocaleString()}
        </div>
        <p className="text-sm text-muted-foreground">
          of ₦{contribution?.targetAmount.toLocaleString()} goal ({progressPercentage}%)
        </p>
      </div>
    </div>
  );
};

export default WalletHeader;
