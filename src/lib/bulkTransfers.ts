export type BulkRecipientInput = { account_bank: string; account_number: string; amount: number; narration: string };

export const PAYROLL_CSV_NAME = "collectipay-payroll-example.csv";
export const PAYROLL_CSV_URL = `/templates/${PAYROLL_CSV_NAME}`;
export const BULK_CSV_MAX_BYTES = 100_000;

export function parseBulkTransferCsv(source: string): BulkRecipientInput[] {
  const csv = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  for (let i = 0; i <= csv.length; i++) {
    const char = i === csv.length ? "\n" : csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === "," || char === "\n") {
      row.push(field.trim());
      field = "";
      closed = false;
      if (char === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (char === '"' && !field && !closed) {
      quoted = true;
    } else if (char === '"' || (closed && !/\s/.test(char))) {
      throw new Error("Check the quotation marks in your CSV.");
    } else if (!closed) field += char;
  }
  if (quoted) throw new Error("A quoted CSV field is incomplete.");
  const header = rows.shift()?.map((key) => key.toLowerCase()) ?? [];
  if (!["bank_code", "account_number", "amount"].every((key) => header.includes(key)) || new Set(header).size !== header.length) {
    throw new Error("Use the CSV template with bank_code, account_number and amount columns.");
  }
  if (rows.length < 2 || rows.length > 50) throw new Error("Enter between 2 and 50 recipients.");
  const column = (cells: string[], key: string) => cells[header.indexOf(key)] ?? "";
  return rows.map((cells, index) => {
    const account_bank = column(cells, "bank_code");
    const account_number = column(cells, "account_number");
    if (account_number === "XXXXXXXXXX") {
      throw new Error(`Replace the example account number in row ${index + 2} with the recipient’s 10-digit account number.`);
    }
    const amountText = column(cells, "amount");
    const amount = Number(amountText.replace(/,/g, ""));
    const narration = column(cells, "narration").replace(/\s+/g, " ");
    if (cells.length !== header.length || !/^[0-9a-z]{2,12}$/i.test(account_bank) || !/^\d{10}$/.test(account_number) ||
      !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(amountText) || amount < 100 || amount > 500000 || narration.length > 120) {
      throw new Error(`Review CSV row ${index + 2}. Use a bank code, a 10-digit account number and an amount between ₦100 and ₦500,000.`);
    }
    return { account_bank, account_number, amount, narration };
  });
}
