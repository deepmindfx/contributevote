import React from "react";
import { CollectiPayReceipt } from "./CollectiPayReceipt";

export interface ReceiptData {
  refNumber: string;
  paymentTime: string;
  paymentMethod: string;
  senderName: string;
  amount: string;
  currency: string;
  groupName?: string;
  description?: string;
}

interface ModernReceiptProps {
  data: ReceiptData;
  onDownload?: () => void;
}

/**
 * Backwards-compatible wrapper around the flagship CollectiPayReceipt
 * used by ContributionHistoryDialog and legacy receipt consumers.
 */
export const ModernReceipt = React.forwardRef<HTMLDivElement, ModernReceiptProps>(
  ({ data }, ref) => {
    const parsedAmount = Number(String(data.amount || "0").replace(/[^0-9.-]/g, "")) || 0;

    return (
      <CollectiPayReceipt
        sheetRef={ref as React.RefObject<HTMLDivElement>}
        showActions={false}
        data={{
          kind: "contribution",
          title: "Group Contribution",
          amount: parsedAmount,
          currency: data.currency || "₦",
          status: "successful",
          date: data.paymentTime,
          reference: data.refNumber,
          groupName: data.groupName,
          paymentMethod: data.paymentMethod,
          narration: data.description,
          sender: data.senderName
            ? { label: "Contributor", name: data.senderName }
            : undefined,
          recipient: data.groupName
            ? { label: "Contribution Pool", name: data.groupName }
            : undefined,
        }}
      />
    );
  }
);

ModernReceipt.displayName = "ModernReceipt";

export { useReceiptDownload } from "./ModernReceiptHook";
