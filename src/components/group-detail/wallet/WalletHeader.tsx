import React from "react";
import { Badge } from "@/components/ui/badge";
import { Contribution } from "@/services/localStorage";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
interface WalletHeaderProps {
  contribution: Contribution;
  progressPercentage: number;
}
const WalletHeader = ({
  contribution,
  progressPercentage
}: WalletHeaderProps) => {
  return <div className="flex flex-col md:flex-row justify-between items-center gap-4">
      <div className="flex items-center gap-3">
        <CollectiPayMark size={44} />
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
          ₦{contribution?.currentAmount?.toLocaleString() || '0'}
        </div>
        <p className="text-sm text-muted-foreground">
          of ₦{contribution?.targetAmount?.toLocaleString() || '0'} goal ({progressPercentage}%)
        </p>
      </div>
    </div>;
};
export default WalletHeader;