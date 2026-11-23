import type { BankOption } from "@/services/supabase/beneficiaryService";

export type BulkRecipientInput = { account_bank: string; account_number: string; amount: number; narration: string };

export const PAYROLL_CSV_NAME = "collectipay-payroll-example.csv";
export const PAYROLL_CSV_URL = `/templates/${PAYROLL_CSV_NAME}`;
export const BULK_CSV_MAX_BYTES = 100_000;

export function parseBulkAmount(value: string) {
  const amount = Number(value.replace(/,/g, ""));
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value) && amount >= 100 && amount <= 500000 ? amount : null;
}

function bankNameKey(name: string) {
  return name.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function parseBulkTransferCsv(source: string, banks: readonly BankOption[]): BulkRecipientInput[] {
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
  if (!["account_number", "amount"].every((key) => header.includes(key)) ||
    !header.some((key) => key === "bank_name" || key === "bank_code") || new Set(header).size !== header.length) {
    throw new Error("Use the CSV template with bank_name, account_number and amount columns. Existing files with bank_code also work.");
  }
  if (rows.length < 2 || rows.length > 50) throw new Error("Enter between 2 and 50 recipients.");
  const column = (cells: string[], key: string) => cells[header.indexOf(key)] ?? "";
  return rows.map((cells, index) => {
    const rowNumber = index + 2;
    const code = column(cells, "bank_code");
    const name = column(cells, "bank_name");
    const account_number = column(cells, "account_number");
    if (account_number === "XXXXXXXXXX") {
      throw new Error(`Replace the example account number in row ${rowNumber} with the recipient’s 10-digit account number.`);
    }
    const amount = parseBulkAmount(column(cells, "amount"));
    const narration = column(cells, "narration").replace(/\s+/g, " ");
    if (cells.length !== header.length || !/^\d{10}$/.test(account_number) || amount === null || narration.length > 120) {
      throw new Error(`Review CSV row ${rowNumber}. Use a 10-digit account number, an amount between ₦100 and ₦500,000, and a narration of up to 120 characters.`);
    }
    const nameKey = bankNameKey(name);
    const matches = banks.filter((bank) => (!code || bank.code === code) && (!name || (
      nameKey !== "" && (bankNameKey(bank.name) === nameKey || Array.from(bank.name.matchAll(/\(([^()]+)\)/g)).some((alias) => bankNameKey(alias[1]) === nameKey))
    )));
    if ((!code && !name) || matches.length !== 1) {
      throw new Error(`Check the bank in CSV row ${rowNumber}. Copy its name from the bank directory or choose the bank in Add recipients.`);
    }
    return { account_bank: matches[0].code, account_number, amount, narration };
  });
}
