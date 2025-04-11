
import { Link } from "react-router-dom";
import { PlusCircle, SendHorizontal, UserPlus, Clock } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import ActionButton from "@/components/wallet/ActionButton";
import DepositDialog from "@/components/wallet/DepositDialog";
import WithdrawDialog from "@/components/wallet/WithdrawDialog";
import { User } from "@/services/localStorage";

interface WalletActionsProps {
  isDepositOpen: boolean;
  setIsDepositOpen: (open: boolean) => void;
  isWithdrawOpen: boolean;
  setIsWithdrawOpen: (open: boolean) => void;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  amount: string;
  setAmount: (amount: string) => void;
  isLoading: boolean;
  handleDeposit: () => void;
  handleWithdraw: () => void;
  user: User;
  currencyType: "NGN" | "USD";
}

const WalletActions = ({
  isDepositOpen,
  setIsDepositOpen,
  isWithdrawOpen,
  setIsWithdrawOpen,
  showHistory,
  setShowHistory,
  amount,
  setAmount,
  isLoading,
  handleDeposit,
  handleWithdraw,
  user,
  currencyType
}: WalletActionsProps) => {
  return (
    <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 overflow-hidden">
      <div className="grid grid-cols-4 gap-1 pt-2 px-4">
        <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
          <ActionButton 
            icon={<PlusCircle size={20} />} 
            label="Top Up"
            isDialogTrigger={true}
          />
          <DepositDialog
            currencyType={currencyType}
            isLoading={isLoading}
            amount={amount}
            setAmount={setAmount}
            onDeposit={handleDeposit}
            onClose={() => setIsDepositOpen(false)}
            user={user}
          />
        </Dialog>
        
        <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
          <ActionButton 
            icon={<SendHorizontal size={20} />} 
            label="Send"
            isDialogTrigger={true}
          />
          <WithdrawDialog
            currencyType={currencyType}
            amount={amount}
            setAmount={setAmount}
            onWithdraw={handleWithdraw}
            onClose={() => setIsWithdrawOpen(false)}
          />
        </Dialog>
        
        <Link to="/create-group">
          <ActionButton 
            icon={<UserPlus size={20} />} 
            label="Group"
          />
        </Link>
        
        <ActionButton 
          icon={<Clock size={20} />} 
          label="History"
          onClick={() => setShowHistory(true)}
        />
      </div>
    </div>
  );
};

export default WalletActions;
