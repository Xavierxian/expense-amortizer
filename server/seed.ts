import { db } from "./db";
import { accounts, fees } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const [existingAccounts] = await db.select({ count: sql<number>`count(*)` }).from(accounts);
  if (Number(existingAccounts.count) > 0) return;

  await db.insert(accounts).values([
    { code: "6602.01", name: "管理费用-摊销", type: "debit" },
    { code: "6601.01", name: "销售费用-摊销", type: "debit" },
    { code: "6603.01", name: "财务费用-摊销", type: "debit" },
    { code: "1801", name: "长期待摊费用", type: "credit" },
    { code: "1301", name: "预付账款", type: "credit" },
  ]);

  await db.insert(fees).values([
    {
      feeCode: "FY-2026-001",
      feeName: "办公室装修费",
      totalAmount: "120000.00",
      feeDate: "2026-01-15",
      sourceRef: "BX-20260115-001",
      sourceSystem: "费控平台",
      hasRule: false,
    },
    {
      feeCode: "FY-2026-002",
      feeName: "年度软件许可费",
      totalAmount: "36000.00",
      feeDate: "2026-02-01",
      sourceRef: "BX-20260201-003",
      sourceSystem: "费控平台",
      hasRule: false,
    },
    {
      feeCode: "FY-2026-003",
      feeName: "设备保险费",
      totalAmount: "24000.00",
      feeDate: "2026-01-20",
      sourceRef: "BX-20260120-005",
      sourceSystem: "OA系统",
      hasRule: false,
    },
    {
      feeCode: "FY-2026-004",
      feeName: "厂房租赁押金摊销",
      totalAmount: "60000.00",
      feeDate: "2026-03-01",
      sourceRef: "HT-20260301-002",
      sourceSystem: "合同管理系统",
      hasRule: false,
    },
  ]);

  console.log("Seed data inserted successfully");
}
