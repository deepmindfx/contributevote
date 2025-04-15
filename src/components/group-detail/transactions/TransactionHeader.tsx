
import React from "react";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface TransactionHeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

const TransactionHeader = ({ onRefresh, isRefreshing }: TransactionHeaderProps) => {
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <div>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>All transactions for this contribution group</CardDescription>
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onRefresh} 
        disabled={isRefreshing}
        className={isRefreshing ? "animate-spin" : ""}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Refresh
      </Button>
    </CardHeader>
  );
};

export default TransactionHeader;
