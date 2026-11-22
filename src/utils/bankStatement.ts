import { completedLedgerEntry, walletMovement } from "@/services/supabase/monthlyLedger";
import type { LedgerEntry } from "@/services/supabase/monthlyLedger";

export async function saveBankStatement(month: string, accountName: string, rows: LedgerEntry[]) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape" });
  const movements = rows.filter((row) => completedLedgerEntry(row) && walletMovement(row) !== 0).slice().reverse();
  const amount = (value: number) => value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
  const incoming = movements.reduce((total, row) => total + Math.max(walletMovement(row), 0), 0);
  const outgoing = movements.reduce((total, row) => total + Math.max(-walletMovement(row), 0), 0);
  doc.setTextColor(14, 65, 46);
  doc.setFontSize(22);
  doc.text("CollectiPay | Wallet statement", 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(25, 44, 37);
  doc.text(doc.splitTextToSize(`${accountName}   |   ${month}   |   Africa/Lagos`, 268), 14, 27);
  doc.text(`Money in: NGN ${amount(incoming)}   |   Money out: NGN ${amount(outgoing)}`, 14, 35);
  autoTable(doc, {
    startY: 42,
    head: [["Date", "Type", "Reference", "Money in (NGN)", "Money out (NGN)", "Balance (NGN)"]],
    body: movements.length ? movements.map((row) => {
      const delta = walletMovement(row);
      return [date.format(new Date(row.created_at)), row.type, row.reference_id || row.id,
        delta > 0 ? amount(delta) : "", delta < 0 ? amount(-delta) : "",
        row.balance_after == null ? "" : amount(Number(row.balance_after))];
    }) : [["No settled wallet movements in this month", "", "", "", "", ""]],
    styles: { fontSize: 9, cellPadding: 2.4, overflow: "linebreak" },
    headStyles: { fillColor: [14, 65, 46] },
    columnStyles: { 2: { cellWidth: 72 }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    didDrawPage: () => { doc.setFontSize(8); doc.text("CollectiPay transaction record", 14, 201); },
  });
  doc.save(`collectipay-statement-${month}.pdf`);
}
