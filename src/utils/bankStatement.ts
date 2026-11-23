import { completedLedgerEntry, walletMovement } from "@/services/supabase/monthlyLedger";
import type { LedgerEntry } from "@/services/supabase/monthlyLedger";
import type { BankOption } from "@/services/supabase/beneficiaryService";
import type { StatementData } from "@/services/supabase/statementService";

const ink = "#102c24";
const evergreen = "#0c3027";
const green = "#146747";
const muted = "#49655b";
const border = "#dce8df";
const money = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dates = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "2-digit", month: "short", year: "numeric" });
const times = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hour12: false });
const months = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });

function transactionLabel(row: LedgerEntry) {
  if (row.payment_method === "fixed_savings") return row.description || "Ice Vault wallet movement";
  if (row.payment_method === "bulk_bank_transfer") return "Bulk bank transfer";
  switch (row.type) {
    case "deposit": return "Wallet deposit";
    case "transfer": return "Bank transfer";
    case "contribution": return "Group contribution";
    case "withdrawal": return row.contribution_id ? "Group payout" : "Wallet withdrawal";
    case "refund": return "Refund";
    default: return row.type === "payment" ? "Payment" : "Wallet adjustment";
  }
}

function showTimestamp(value: string) {
  const timestamp = new Date(value);
  return dates.format(timestamp) + "\n" + times.format(timestamp);
}

function bulkReport(statement: Extract<StatementData, { scope: "bulk" }>, banks?: BankOption[]) {
  const names = new Map(banks?.map(({ code, name }) => [code, name]));
  const paid = statement.entries.filter((row) => row.status === "completed");
  const principal = paid.reduce((cents, { amount }) => cents + Math.round(amount * 100), 0) / 100;
  const fees = paid.reduce((cents, { fee }) => cents + Math.round(fee * 100), 0) / 100;
  const vat = paid.reduce((cents, { vat }) => cents + Math.round(vat * 100), 0) / 100;
  const net = statement.entries.reduce((totals, { status, total }) => {
    if (status === "failed") totals.refunded += Math.round(total * 100);
    if (status === "pending") totals.pending += Math.round(total * 100);
    return totals;
  }, { refunded: 0, pending: 0 });
  return {
    title: "Bulk transfer statement",
    section: "Recipient payouts",
    metrics: [["Principal paid", principal], ["Still reserved", net.pending / 100], ["Returned", net.refunded / 100]] as const,
    charges: "Fees paid: NGN " + money.format(fees) + "   |   VAT paid: NGN " + money.format(vat),
    headings: ["Authorized / batch", "Recipient bank details", "Principal", "Fee / VAT", "Status", "Wallet debit"],
    rows: statement.entries.map((row) => [
      [showTimestamp(row.authorized_at), row.batch_name, row.reference].filter(Boolean).join("\n"),
      [row.recipient_name, row.bank_name || names.get(row.bank_code || "") || (row.bank_code ? "Bank " + row.bank_code : null),
        row.account_number ? "Account " + row.account_number : null].filter(Boolean).join("\n"),
      money.format(row.amount),
      money.format(row.fee) + "\nVAT " + money.format(row.vat),
      row.status === "completed" ? "Paid" : row.status === "failed" ? "Refunded" : "Pending",
      money.format(row.total),
    ]),
    empty: "No bulk payouts were authorized during the selected month.",
    footer: "All amounts are in NGN. Wallet debit includes the fee and VAT before any refund.",
  };
}

function walletReport(statement: Extract<StatementData, { scope: "wallet" }>) {
  const movements = statement.entries.filter(completedLedgerEntry)
    .map((row) => ({ row, delta: walletMovement(row) })).filter(({ delta }) => delta !== 0);
  const incoming = movements.reduce((value, { delta }) => value + Math.max(delta, 0), 0);
  const outgoing = movements.reduce((value, { delta }) => value + Math.max(-delta, 0), 0);
  return {
    title: "Wallet statement",
    section: "Settled wallet activity",
    metrics: [["Money in", incoming], ["Money out", outgoing], ["Net movement", incoming - outgoing]] as const,
    charges: "",
    headings: ["Date and time", "Transaction / reference", "Money in", "Money out", "Balance"],
    rows: movements.map(({ row, delta }) => [
      showTimestamp(row.created_at),
      transactionLabel(row) + "\n" + (row.reference_id || row.id),
      delta > 0 ? money.format(delta) : "",
      delta < 0 ? money.format(-delta) : "",
      row.balance_after == null ? "-" : money.format(Number(row.balance_after)),
    ]),
    empty: "No settled wallet movements for this statement period.",
    footer: "All amounts are in NGN. Balances are shown as recorded in the wallet ledger.",
  };
}

export async function createBankStatementPdf(statement: StatementData, banks?: BankOption[]) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ format: "a4", unit: "mm", compress: true });
  const bulk = statement.scope === "bulk";
  const report = statement.scope === "bulk" ? bulkReport(statement, banks) : walletReport(statement);
  const month = months.format(new Date(statement.month + "-01T00:00:00Z"));
  doc.setProperties({ title: "CollectiPay " + report.title, author: "CollectiPay", subject: month });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;
  const content = width - margin * 2;
  const text = (value: string, x: number, y: number, size: number, color: string, bold = false, right = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(value, x, y, right ? { align: "right" } : undefined);
  };
  const brand = (x: number, y: number) => {
    doc.setFillColor("#218f61");
    doc.circle(x + 4, y - 1.5, 4, "F");
    text("C", x + 1.75, y + 0.65, 17, "#ffffff", true);
    text("CollectiPay", x + 11, y, 16, "#ffffff", true);
  };

  doc.setFillColor(evergreen);
  doc.rect(0, 0, width, 53, "F");
  doc.setFillColor("#1d5e49");
  doc.circle(width - 7, 0, 31, "F");
  doc.setFillColor("#ddf4b7");
  doc.rect(margin, 50, 22, 1.2, "F");
  brand(margin, 15.5);
  text(report.title, margin, 33, 24, "#ffffff", true);
  text(month, margin, 42, 11, "#c8e9d8");
  text("NGN  |  WAT", width - margin, 42, 10, "#ddf4b7", true, true);

  text("ACCOUNT HOLDER", margin, 64, 8, muted, true);
  text("ISSUED", width - margin, 64, 8, muted, true, true);
  doc.setFont("helvetica", "bold").setFontSize(13);
  const holder = doc.splitTextToSize(statement.holder?.trim() || "CollectiPay account", content * 0.63) as string[];
  holder.forEach((line, index) => text(line, margin, 71 + index * 5, 13, ink, true));
  text(dates.format(new Date(statement.generated_at)), width - margin, 71, 11, ink, true, true);
  text(times.format(new Date(statement.generated_at)) + " WAT", width - margin, 77, 9, muted, false, true);

  let identityY = 75 + (holder.length - 1) * 5;
  if (statement.account_number || statement.bank_name) {
    doc.setFont("helvetica", "normal").setFontSize(9.5);
    const bank = doc.splitTextToSize(statement.bank_name || "Wallet bank account", content * 0.63) as string[];
    bank.forEach((line) => { text(line, margin, identityY + 4, 9.5, muted); identityY += 4; });
    if (statement.account_number) {
      text("Account number " + statement.account_number, margin, identityY + 5, 10, ink, true);
      identityY += 5;
    }
  }

  const summaryY = Math.max(83, identityY) + 7;
  const gap = 3;
  const tile = (content - gap * 2) / 3;
  report.metrics.forEach(([label, value], index) => {
    const x = margin + index * (tile + gap);
    doc.setFillColor(index === 0 ? "#eaf5ee" : "#f6f9f7");
    doc.setDrawColor(border);
    doc.roundedRect(x, summaryY, tile, 21, 2.4, 2.4, "FD");
    text(label, x + 4, summaryY + 7, 9, green, true);
    const formatted = money.format(value);
    doc.setFont("helvetica", "bold").setFontSize(15);
    text(formatted, x + 4, summaryY + 15, Math.min(15, (tile - 8) * 15 / Math.max(1, doc.getTextWidth(formatted))), ink, true);
  });

  const tableTitle = summaryY + (report.charges ? 40 : 32);
  if (report.charges) text(report.charges, margin, summaryY + 28, 9, muted);
  text(report.section, margin, tableTitle, 13, ink, true);
  text(report.rows.length + (report.rows.length === 1 ? " entry" : " entries"), width - margin, tableTitle, 9, muted, false, true);

  autoTable(doc, {
    startY: tableTitle + 4,
    margin: { left: margin, right: margin, top: 23, bottom: 21 },
    theme: "plain",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    head: [report.headings],
    body: report.rows.length ? report.rows : [[{ content: report.empty, colSpan: report.headings.length }]],
    styles: { fontSize: 8.5, cellPadding: 2.5, valign: "middle", overflow: "linebreak", textColor: ink, lineColor: border },
    headStyles: { fillColor: evergreen, textColor: "#ffffff", fontStyle: "bold" },
    alternateRowStyles: { fillColor: "#f3f8f5" },
    columnStyles: bulk
      ? { 0: { cellWidth: content - 143 }, 1: { cellWidth: 50 }, 2: { cellWidth: 24 }, 3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 25 } }
      : { 0: { cellWidth: 27 }, 1: { cellWidth: content - 102 }, 2: { cellWidth: 24 }, 3: { cellWidth: 24 }, 4: { cellWidth: 27 } },
    didParseCell: ({ cell, column, section }) => {
      if (column.index < 2 || cell.colSpan > 1) return;
      cell.styles.halign = bulk && column.index === 4 ? "center" : "right";
      if (section !== "body") return;
      if (cell.text.some((line) => line.length > 15)) cell.styles.fontSize = 7;
      if (!bulk && column.index === 2) cell.styles.textColor = green;
      if (bulk && column.index === 4) {
        cell.styles.fontStyle = "bold";
        cell.styles.textColor = cell.text[0] === "Paid" ? green : cell.text[0] === "Refunded" ? "#a02e41" : "#8c5a1c";
      }
    },
    willDrawPage: ({ pageNumber }) => {
      if (pageNumber === 1) return;
      doc.setFillColor(evergreen);
      doc.rect(0, 0, width, 18, "F");
      brand(margin, 11);
      text(report.title + "  /  " + month, width - margin, 11, 9, "#c8e9d8", false, true);
    },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(border);
    doc.line(margin, height - 16, width - margin, height - 16);
    text(report.footer, margin, height - 10, 7.5, muted);
    text(page + " / " + pages, width - margin, height - 10, 8, ink, true, true);
  }

  return doc;
}

export async function saveBankStatement(statement: StatementData, banks?: BankOption[]) {
  const doc = await createBankStatementPdf(statement, banks);
  doc.save("collectipay-" + (statement.scope === "bulk" ? "bulk-transfer" : "wallet") + "-statement-" + statement.month + ".pdf");
}
