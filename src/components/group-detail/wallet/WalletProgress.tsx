
import React from "react";
import { Progress } from "@/components/ui/progress";

interface WalletProgressProps {
  progressPercentage: number;
}

const WalletProgress = ({ progressPercentage }: WalletProgressProps) => {
  return (
    <div className="mt-4">
      <Progress value={progressPercentage} className="h-2" />
    </div>
  );
};

export default WalletProgress;
