import { completedLedgerEntry, walletMovement } from "@/services/supabase/monthlyLedger";
import type { LedgerEntry } from "@/services/supabase/monthlyLedger";

const ink = "#102c24";
const emerald = "#0c3027";
const green = "#146747";
const mint = "#eaf5ee";
const muted = "#49655b";
const border = "#dce8df";
const money = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dates = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "2-digit", month: "short", year: "numeric" });
const times = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hour12: false });
const months = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });

function transactionLabel(row: LedgerEntry) {
  if (row.payment_method === "fixed_savings") return row.description || "Ice Vault wallet movement";
  switch (row.type) {
    case "deposit": return "Wallet deposit";
    case "transfer": return "Bank transfer";
    case "contribution": return "Group contribution";
    case "withdrawal": return row.contribution_id ? "Group payout" : "Wallet withdrawal";
    case "refund": return "Refund";
    default: return row.type === "payment" ? "Payment" : "Wallet adjustment";
  }
}

export async function saveBankStatement(month: string, accountName: string, rows: LedgerEntry[], accountNumber?: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ format: "a4", unit: "mm", compress: true });
  doc.setProperties({ title: "CollectiPay Wallet Statement", author: "CollectiPay", subject: month });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;
  const content = width - margin * 2;
  const monthLabel = months.format(new Date(month + "-01T00:00:00Z"));
  const generated = dates.format(new Date());

  const movements = rows
    .filter(completedLedgerEntry)
    .map((row) => ({ row, delta: walletMovement(row) }))
    .filter(({ delta }) => delta !== 0)
    .sort((a, b) => Date.parse(a.row.created_at) - Date.parse(b.row.created_at));
  const incoming = movements.reduce((value, { delta }) => value + Math.max(delta, 0), 0);
  const outgoing = movements.reduce((value, { delta }) => value + Math.max(-delta, 0), 0);

  const text = (label: string, x: number, y: number, size: number, color: string, bold = false, right = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(label, x, y, right ? { align: "right" } : undefined);
  };
  const brand = (x: number, y: number) => {
    doc.setFillColor("#218f61");
    doc.circle(x + 4, y - 1.4, 4, "F");
    text("C", x + 1.75, y + 0.8, 17, "#ffffff", true);
    text("CollectiPay", x + 11, y, 16, "#ffffff", true);
  };

  doc.setFillColor(emerald);
  doc.rect(0, 0, width, 52, "F");
  doc.setFillColor("#1d5e49");
  doc.circle(width - 8, 2, 27, "F");
  doc.setFillColor("#ddf4b7");
  doc.rect(margin, 49.5, 21, 1.1, "F");
  brand(margin, 15);
  text("WALLET STATEMENT", margin, 33, 24, "#ffffff", true);
  text(monthLabel, margin, 42, 11, "#c8e9d8");
  text("NGN", width - margin, 42, 11, "#ddf4b7", true, true);

  text("ACCOUNT HOLDER", margin, 64, 8, muted, true);
  text("ISSUED", width - margin, 64, 8, muted, true, true);
  doc.setFont("helvetica", "bold").setFontSize(13);
  const nameLines = doc.splitTextToSize(accountName, content * 0.63) as string[];
  nameLines.forEach((line, index) => text(line, margin, 71 + index * 5.4, 13, ink, true));
  text(generated, width - margin, 71, 11, ink, true, true);
  text("West Africa Time (WAT)", width - margin, 77, 8, muted, false, true);
  const lastFour = accountNumber?.match(/[0-9]{4}$/)?.[0];
  const identityBottom = Math.max(82, 73 + (nameLines.length - 1) * 5.4);
  if (lastFour) text("Wallet account ending " + lastFour, margin, identityBottom, 9, muted);

  const summaryY = identityBottom + 7;
  const tileGap = 3;
  const tileWidth = (content - tileGap * 2) / 3;
  const metrics = [["Money in", incoming], ["Money out", outgoing], ["Net movement", incoming - outgoing]] as const;
  metrics.forEach(([label, value], index) => {
    const x = margin + index * (tileWidth + tileGap);
    doc.setFillColor(index === 0 ? mint : "#f6f9f7");
    doc.setDrawColor(border);
    doc.roundedRect(x, summaryY, tileWidth, 21, 2.5, 2.5, "FD");
    text(label, x + 4, summaryY + 7, 9, green, true);
    const amount = money.format(value);
    doc.setFont("helvetica", "bold").setFontSize(15);
    const size = Math.min(15, (tileWidth - 8) * 15 / Math.max(1, doc.getTextWidth(amount)));
    text(amount, x + 4, summaryY + 15, size, ink, true);
  });

  const tableTitle = summaryY + 32;
  text("Settled wallet activity", margin, tableTitle, 13, ink, true);
  text(movements.length + (movements.length === 1 ? " entry" : " entries"), width - margin, tableTitle, 9, muted, false, true);

  autoTable(doc, {
    startY: tableTitle + 4,
    margin: { left: margin, right: margin, top: 23, bottom: 21 },
    theme: "plain",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    head: [["Date and time", "Transaction / reference", "Money in", "Money out", "Balance"]],
    body: movements.length ? movements.map(({ row, delta }) => {
      const timestamp = new Date(row.created_at);
      return [
        dates.format(timestamp) + "\n" + times.format(timestamp),
        transactionLabel(row) + "\n" + (row.reference_id || row.id),
        delta > 0 ? money.format(delta) : "",
        delta < 0 ? money.format(-delta) : "",
        row.balance_after == null ? "-" : money.format(Number(row.balance_after)),
      ];
    }) : [[{ content: "No settled wallet movements for this statement period.", colSpan: 5 }]],
    styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 }, valign: "middle", overflow: "linebreak", textColor: ink, lineColor: border },
    headStyles: { fillColor: emerald, textColor: "#ffffff", fontStyle: "bold" },
    alternateRowStyles: { fillColor: "#f3f8f5" },
    columnStyles: {
      0: { cellWidth: 27 },
      1: { cellWidth: content - 102 },
      2: { cellWidth: 24, halign: "right", textColor: green },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 27, halign: "right", fontStyle: "bold" },
    },
    didParseCell: ({ cell, column, section }) => {
      if (column.index < 2) return;
      cell.styles.halign = "right";
      if (section === "body") cell.styles.fontSize = cell.text.join("").length > 15 ? 7 : 8.5;
      if (section === "body" && column.index === 2) cell.styles.textColor = green;
    },
    willDrawPage: ({ pageNumber }) => {
      if (pageNumber === 1) return;
      doc.setFillColor(emerald);
      doc.rect(0, 0, width, 18, "F");
      brand(margin, 11);
      text("Wallet statement  /  " + monthLabel, width - margin, 11, 9, "#c8e9d8", false, true);
    },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(border);
    doc.line(margin, height - 16, width - margin, height - 16);
    text("Amounts in NGN. Balances are shown as recorded in the wallet ledger.", margin, height - 10, 7.5, muted);
    text(page + " / " + pages, width - margin, height - 10, 8, ink, true, true);
  }

  doc.save("collectipay-statement-" + month + ".pdf");
}
