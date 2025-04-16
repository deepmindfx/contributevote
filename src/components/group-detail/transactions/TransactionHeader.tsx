
import React from "react";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface TransactionHeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

const TransactionHeader = ({ onRefresh, isRefreshing }: TransactionHeaderProps) => {
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <CardTitle>Transactions</CardTitle>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onRefresh} 
        disabled={isRefreshing}
        className="h-8 w-8 p-0"
        aria-label="Refresh transactions"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </Button>
    </CardHeader>
  );
};

export default TransactionHeader;
