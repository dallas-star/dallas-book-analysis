import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface XlsxRow {
  hubspot_id: number;
  charge_year: number;
  charge_month: number;
  amount_charged: number;
}

function computeSuggestedSpend(): Record<string, number> {
  const xlsxPath = path.join(process.cwd(), "account charges to Jan 2026 - Dallas.xlsx");
  const buffer = fs.readFileSync(xlsxPath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<XlsxRow>(sheet);

  const byAccount: Record<string, { yearMonth: number; amount: number }[]> = {};
  for (const row of rows) {
    const id = String(row.hubspot_id);
    if (!id || row.amount_charged == null || !row.charge_year || !row.charge_month) continue;
    if (!byAccount[id]) byAccount[id] = [];
    byAccount[id].push({
      yearMonth: row.charge_year * 100 + row.charge_month,
      amount: row.amount_charged,
    });
  }

  const jan2026 = 202601;
  const result: Record<string, number> = {};
  for (const [id, entries] of Object.entries(byAccount)) {
    entries.sort((a, b) => a.yearMonth - b.yearMonth);
    const mostRecentYM = entries[entries.length - 1].yearMonth;
    if (mostRecentYM < jan2026) continue;
    const last3 = entries.slice(-3);
    const avg = last3.reduce((sum, e) => sum + e.amount, 0) / last3.length;
    result[id] = Math.round(avg * 100) / 100;
  }

  return result;
}

interface BookRow {
  Company: string;
  "Last Review": string;
  "In Contract": string;
  "Renewal Date": string;
  "Monthly Spend": string;
  Locations: string;
  Responsiveness: string;
}

function loadBookData(): Record<string, BookRow> {
  const bookPath = path.join(process.cwd(), "book-analysis-2026-03-26.csv");
  if (!fs.existsSync(bookPath)) return {};
  const csvText = fs.readFileSync(bookPath, "utf-8");
  const result = Papa.parse<BookRow>(csvText, { header: true, skipEmptyLines: true });
  const map: Record<string, BookRow> = {};
  for (const row of result.data) {
    const key = row.Company?.trim().toLowerCase();
    if (key) map[key] = row;
  }
  return map;
}

export async function GET() {
  const csvPath = path.join(process.cwd(), "hubspot-crm-exports-my-active-clients-2026-03-25.csv");
  const csvText = fs.readFileSync(csvPath, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = Papa.parse<any>(csvText, { header: true, skipEmptyLines: true });

  const suggestedSpend = computeSuggestedSpend();
  const bookData = loadBookData();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = (result.data as any[]).filter((row) => {
    const key = row["Company name"]?.trim().toLowerCase();
    return key && bookData[key];
  }).map((row) => {
    const key = row["Company name"]?.trim().toLowerCase();
    const book = bookData[key] ?? null;

    return {
      id: row["Record ID"],
      company: row["Company name"],
      lastReview: book?.["Last Review"] ?? row["Date of Last Account Review"] ?? "",
      renewalDate: row["Next Texting Renewal Date"],
      csHealth: row["CS Health"],
      redFlag: row["Red Flag Type"],
      city: row["City"],
      pos: row["Point of Sale"],
      status: row["Account Status"],
      launchDate: row["Launch Date"],
      suggestedSpend: suggestedSpend[row["Record ID"]] ?? null,
      monthlySpend: book?.["Monthly Spend"] ?? "",
      locations: book?.["Locations"] ?? "",
      responsiveness: book?.["Responsiveness"] ?? "",
      inContract: book?.["In Contract"] === "Y",
    };
  });

  return NextResponse.json(accounts);
}
