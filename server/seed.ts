import { db } from "./db";
import { entities, accounts, ruleTemplates, fees } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const [existingEntities] = await db.select({ count: sql<number>`count(*)` }).from(entities);
  if (Number(existingEntities.count) > 0) return;

  await db.insert(entities).values([
    { code: "E001", name: "总公司", remark: "集团总部" },
    { code: "E002", name: "华东分公司", remark: "上海/江浙区域" },
    { code: "E003", name: "华南分公司", remark: "广东/福建区域" },
  ]);

  const entityList = await db.select().from(entities);
  const hq = entityList.find(e => e.code === "E001")!;
  const east = entityList.find(e => e.code === "E002")!;

  await db.insert(accounts).values([
    { code: "6602.01", name: "管理费用-摊销", type: "debit" },
    { code: "6601.01", name: "销售费用-摊销", type: "debit" },
    { code: "6603.01", name: "财务费用-摊销", type: "debit" },
    { code: "1801", name: "长期待摊费用", type: "credit" },
    { code: "1301", name: "预付账款", type: "credit" },
  ]);

  const accts = await db.select().from(accounts);
  const debitMgmt = accts.find(a => a.code === "6602.01")!;
  const creditLong = accts.find(a => a.code === "1801")!;
  const creditPrepay = accts.find(a => a.code === "1301")!;

  await db.insert(ruleTemplates).values([
    { name: "装修费", defaultMonths: 36, method: "monthly", debitAccountId: debitMgmt.id, creditAccountId: creditLong.id, remark: "办公室装修按36个月摊销" },
    { name: "软件许可费", defaultMonths: 12, method: "monthly", debitAccountId: debitMgmt.id, creditAccountId: creditLong.id, remark: "软件授权通常按年摊销" },
    { name: "保险费", defaultMonths: 12, method: "monthly", debitAccountId: debitMgmt.id, creditAccountId: creditPrepay.id, remark: "保险费用按保单期限摊销" },
    { name: "租赁", defaultMonths: 12, method: "monthly", debitAccountId: debitMgmt.id, creditAccountId: creditPrepay.id, remark: "租赁费用按租期摊销，可调整月数" },
  ]);

  await db.insert(fees).values([
    {
      entityId: hq.id,
      feeCode: "FY-2026-001", feeName: "办公室装修费", totalAmount: "120000.00",
      feeDate: "2026-01-15", sourceRef: "BX-20260115-001", sourceSystem: "费控平台",
      amortMonths: 36, startMonth: "2026-01", endMonth: "2028-12",
      debitAccountId: debitMgmt.id, creditAccountId: creditLong.id, amortConfigured: false,
    },
    {
      entityId: hq.id,
      feeCode: "FY-2026-002", feeName: "年度软件许可费", totalAmount: "36000.00",
      feeDate: "2026-02-01", sourceRef: "BX-20260201-003", sourceSystem: "费控平台",
      amortMonths: 12, startMonth: "2026-02", endMonth: "2027-01",
      debitAccountId: debitMgmt.id, creditAccountId: creditLong.id, amortConfigured: false,
    },
    {
      entityId: east.id,
      feeCode: "FY-2026-003", feeName: "设备保险费", totalAmount: "24000.00",
      feeDate: "2026-01-20", sourceRef: "BX-20260120-005", sourceSystem: "OA系统",
      amortMonths: 12, startMonth: "2026-01", endMonth: "2026-12",
      debitAccountId: debitMgmt.id, creditAccountId: creditPrepay.id, amortConfigured: false,
    },
    {
      entityId: east.id,
      feeCode: "FY-2026-004", feeName: "厂房租赁押金摊销", totalAmount: "60000.00",
      feeDate: "2026-03-01", sourceRef: "HT-20260301-002", sourceSystem: "合同管理系统",
      amortMonths: 12, startMonth: "2026-03", endMonth: "2027-02",
      debitAccountId: debitMgmt.id, creditAccountId: creditPrepay.id, amortConfigured: false,
    },
  ]);

  console.log("Seed data inserted successfully");
}
