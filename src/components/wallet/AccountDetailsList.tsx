
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { ReservedAccountData } from "@/services/wallet/types";

interface AccountDetailsListProps {
  account: ReservedAccountData;
  onCopy: (text: string, label: string) => void;
}

const AccountDetailsList = ({ account, onCopy }: AccountDetailsListProps) => {
  const details = [
    { label: 'Account Name', value: account.accountName },
    { label: 'Account Reference', value: account.accountReference },
    { label: 'Bank Code', value: account.bankCode },
    { label: 'Created On', value: new Date(account.createdOn || '').toLocaleDateString() },
    { label: 'Currency', value: 'NGN' },
    { label: 'Collection Channel', value: 'Bank Transfer' },
    { label: 'Status', value: account.status || 'Active' },
  ];

  return (
    <div className="space-y-3">
      {details.map((detail) => detail.value && (
        <div key={detail.label} className="bg-muted/30 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm text-muted-foreground">{detail.label}</div>
            {detail.value && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={() => onCopy(detail.value.toString(), detail.label)}
              >
                <Copy className="h-3 w-3 mr-1" />
                <span className="text-xs">Copy</span>
              </Button>
            )}
          </div>
          <div className="font-medium truncate">{detail.value}</div>
        </div>
      ))}
    </div>
  );
};

export default AccountDetailsList;
