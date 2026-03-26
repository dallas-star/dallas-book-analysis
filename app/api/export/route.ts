import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const { csv } = await req.json();
  const date = new Date().toISOString().slice(0, 10);
  const filePath = path.join(process.cwd(), `book-analysis-${date}.csv`);
  fs.writeFileSync(filePath, csv, "utf-8");
  return NextResponse.json({ saved: filePath });
}
