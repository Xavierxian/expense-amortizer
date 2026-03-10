import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAccountSchema, insertFeeSchema, insertRuleTemplateSchema, insertEntitySchema } from "@shared/schema";
import multer from "multer";
import * as XLSX from "xlsx";

const upload = multer({ storage: multer.memoryStorage() });

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function feeeDateToMonth(feeDate: string): string {
  if (!feeDate) return getCurrentMonth();
  const parts = feeDate.split("-");
  if (parts.length >= 2) return `${parts[0]}-${parts[1].padStart(2, "0")}`;
  return getCurrentMonth();
}

function addMonths(yearMonth: string, count: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const totalMonths = y * 12 + (m - 1) + (count - 1);
  const newY = Math.floor(totalMonths / 12);
  const newM = (totalMonths % 12) + 1;
  return `${newY}-${String(newM).padStart(2, "0")}`;
}

function getMonthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

function calculateAmortization(totalAmount: number, months: string[]): { month: string; amount: number }[] {
  const count = months.length;
  if (count === 0) return [];
  const perMonth = Math.floor(totalAmount * 100 / count) / 100;
  return months.map((month, i) => ({
    month,
    amount: i < count - 1 ? perMonth : Math.round((totalAmount - perMonth * (count - 1)) * 100) / 100,
  }));
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/dashboard", async (_req, res) => {
    const currentMonth = getCurrentMonth();
    const stats = await storage.getDashboardStats(currentMonth);
    res.json(stats);
  });

  app.get("/api/entities", async (_req, res) => {
    const list = await storage.getEntities();
    res.json(list);
  });

  app.post("/api/entities", async (req, res) => {
    const parsed = insertEntitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const entity = await storage.createEntity(parsed.data);
      res.json(entity);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.put("/api/entities/:id", async (req, res) => {
    const parsed = insertEntitySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const entity = await storage.updateEntity(Number(req.params.id), parsed.data);
    if (!entity) return res.status(404).json({ message: "Not found" });
    res.json(entity);
  });

  app.delete("/api/entities/:id", async (req, res) => {
    const ok = await storage.deleteEntity(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  });

  app.get("/api/accounts", async (_req, res) => {
    const list = await storage.getAccounts();
    res.json(list);
  });

  app.post("/api/accounts", async (req, res) => {
    const parsed = insertAccountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const account = await storage.createAccount(parsed.data);
      res.json(account);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.put("/api/accounts/:id", async (req, res) => {
    const account = await storage.updateAccount(Number(req.params.id), req.body);
    if (!account) return res.status(404).json({ message: "Not found" });
    res.json(account);
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    const ok = await storage.deleteAccount(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  });

  app.get("/api/rule-templates", async (_req, res) => {
    const list = await storage.getRuleTemplates();
    res.json(list);
  });

  app.post("/api/rule-templates", async (req, res) => {
    const parsed = insertRuleTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const t = await storage.createRuleTemplate(parsed.data);
      res.json(t);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.put("/api/rule-templates/:id", async (req, res) => {
    const parsed = insertRuleTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const t = await storage.updateRuleTemplate(Number(req.params.id), parsed.data);
    if (!t) return res.status(404).json({ message: "Not found" });
    res.json(t);
  });

  app.delete("/api/rule-templates/:id", async (req, res) => {
    const ok = await storage.deleteRuleTemplate(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  });

  app.get("/api/fees", async (req, res) => {
    const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;
    const list = await storage.getFees(entityId);
    res.json(list);
  });

  app.post("/api/fees", async (req, res) => {
    const parsed = insertFeeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const fee = await storage.createFee(parsed.data);
      res.json(fee);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/fees/:id", async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteEntriesByFeeId(id);
    const ok = await storage.deleteFee(id);
    if (!ok) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  });

  app.get("/api/import-template", (_req, res) => {
    const wb = XLSX.utils.book_new();
    const header = ["费用编号", "费用名称", "总金额", "费用发生日期", "来源单据号", "来源系统"];
    const sample = [
      ["FY-2026-001", "办公室装修费", 120000, "2026-01-15", "BX-20260115-001", "费控平台"],
      ["FY-2026-002", "年度软件许可费", 36000, "2026-02-01", "BX-20260201-003", "费控平台"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...sample]);
    ws["!cols"] = [{ wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "费用导入模板");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", 'attachment; filename="fee_import_template.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  });

  app.post("/api/import-fee", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const entityId = Number(req.body.entityId);
      if (!entityId) return res.status(400).json({ message: "请选择主体" });

      const entity = await storage.getEntity(entityId);
      if (!entity) return res.status(400).json({ message: "主体不存在" });

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        const feeCode = String(row["费用编号"] || row["feeCode"] || row["fee_code"] || "").trim();
        const feeName = String(row["费用名称"] || row["feeName"] || row["fee_name"] || "").trim();
        const totalAmount = String(row["总金额"] || row["totalAmount"] || row["total_amount"] || "0");
        const feeDate = String(row["费用发生日期"] || row["feeDate"] || row["fee_date"] || "").trim();
        const sourceRef = String(row["来源单据号"] || row["sourceRef"] || row["source_ref"] || "").trim();
        const sourceSystem = String(row["来源系统"] || row["sourceSystem"] || row["source_system"] || "").trim();

        if (!feeCode || !feeName) { skipped++; continue; }

        const existing = await storage.getFeeByCode(feeCode);
        if (existing) { skipped++; continue; }

        const template = await storage.getRuleTemplateByName(feeName);
        const startMonth = feeeDateToMonth(feeDate);
        const amortMonths = template?.defaultMonths || null;
        const endMonth = amortMonths ? addMonths(startMonth, amortMonths) : null;

        await storage.createFee({
          entityId,
          feeCode,
          feeName,
          totalAmount,
          feeDate,
          sourceRef: sourceRef || null,
          sourceSystem: sourceSystem || null,
          amortMonths,
          startMonth,
          endMonth,
          debitAccountId: template?.debitAccountId || null,
          creditAccountId: template?.creditAccountId || null,
          amortConfigured: false,
        });
        imported++;
      }

      res.json({ imported, skipped, total: rows.length });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/configure-fee-amort/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const fee = await storage.getFee(id);
      if (!fee) return res.status(404).json({ message: "Fee not found" });

      const { amortMonths, debitAccountId, creditAccountId } = req.body;
      if (!amortMonths || amortMonths < 1) {
        return res.status(400).json({ message: "Amortization months must be at least 1" });
      }

      const startMonth = feeeDateToMonth(fee.feeDate);
      const endMonth = addMonths(startMonth, amortMonths);

      await storage.deleteEntriesByFeeId(id);

      await storage.updateFee(id, {
        amortMonths,
        startMonth,
        endMonth,
        debitAccountId: debitAccountId || null,
        creditAccountId: creditAccountId || null,
        amortConfigured: true,
      });

      const months = getMonthsBetween(startMonth, endMonth);
      const totalAmount = parseFloat(fee.totalAmount);
      const amortEntries = calculateAmortization(totalAmount, months);

      let cumulative = 0;
      for (const entry of amortEntries) {
        cumulative += entry.amount;
        const remaining = Math.round((totalAmount - cumulative) * 100) / 100;
        await storage.createEntry({
          feeId: id,
          month: entry.month,
          amount: entry.amount.toFixed(2),
          cumulativeAmount: cumulative.toFixed(2),
          remainingAmount: remaining.toFixed(2),
          voucherGenerated: false,
        });
      }

      res.json({ success: true, entriesCount: amortEntries.length, startMonth, endMonth });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/amort-table", async (req, res) => {
    const month = (req.query.month as string) || getCurrentMonth();
    const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;
    const entries = await storage.getEntriesByMonth(month, entityId);
    res.json(entries);
  });

  app.post("/api/generate-voucher", async (req, res) => {
    try {
      const month = req.body.month || getCurrentMonth();
      const entityId = req.body.entityId ? Number(req.body.entityId) : undefined;

      if (!entityId) {
        return res.status(400).json({ message: "请选择主体" });
      }

      const entries = await storage.getEntriesByMonth(month, entityId);
      const ungenerated = entries.filter(e => !e.voucherGenerated);

      if (ungenerated.length === 0) {
        return res.json({ generated: 0, message: "该主体当月无待生成凭证的摊销记录" });
      }

      const withoutAccounts = ungenerated.filter(e => !e.debitAccountCode || !e.creditAccountCode);
      if (withoutAccounts.length > 0) {
        return res.status(400).json({
          message: `${withoutAccounts.length} 条摊销记录未配置借方或贷方科目，请先完善费用的摊销配置`,
        });
      }

      const voucherCount = await storage.getVoucherCount();
      let counter = voucherCount + 1;
      const generated: any[] = [];

      for (const entry of ungenerated) {
        const voucherNo = `PZ-${month.replace("-", "")}-${String(counter).padStart(4, "0")}`;
        const voucherDate = `${month}-01`;

        const voucher = await storage.createVoucher({
          entityId,
          voucherNo,
          voucherDate,
          month,
          summary: `${entry.feeName} ${month} 摊销`,
          debitAccountCode: entry.debitAccountCode || "",
          debitAccountName: entry.debitAccountName || "",
          creditAccountCode: entry.creditAccountCode || "",
          creditAccountName: entry.creditAccountName || "",
          amount: entry.amount,
          feeId: entry.feeId,
          entryId: entry.id,
        });

        await storage.markEntryVoucherGenerated(entry.id);
        generated.push(voucher);
        counter++;
      }

      res.json({ generated: generated.length, vouchers: generated });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/vouchers", async (req, res) => {
    const month = (req.query.month as string) || getCurrentMonth();
    const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;
    const list = await storage.getVouchersByMonth(month, entityId);
    res.json(list);
  });

  return httpServer;
}
