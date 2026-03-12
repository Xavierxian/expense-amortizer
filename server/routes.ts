import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAccountSchema, insertFeeSchema, insertRuleTemplateSchema, insertEntitySchema } from "@shared/schema";
import multer from "multer";
import * as XLSX from "xlsx";
import OpenAI from "openai";

const upload = multer({ storage: multer.memoryStorage() });

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) return null;
  return new OpenAI({ apiKey, baseURL });
}

async function matchCategoryWithAI(
  feeTypeName: string,
  templateNames: string[]
): Promise<string | null> {
  if (templateNames.length === 0) return null;
  const client = getOpenAIClient();
  if (!client) return null;
  try {
    const resp = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `你是一个中文财务费用分类助手。用户会提供一个费用类型名称和若干现有费用类别模板名称。
请判断该费用类型是否与某个现有模板属于同一类别。如果匹配，返回完全一致的模板名称；如果没有合适的匹配，返回字符串 "NONE"。
只返回模板名称或 "NONE"，不要有任何其他解释。`,
        },
        {
          role: "user",
          content: `费用类型名称：${feeTypeName}\n现有模板：${templateNames.join("、")}`,
        },
      ],
      max_completion_tokens: 100,
    });
    const answer = resp.choices[0]?.message?.content?.trim() ?? "NONE";
    if (answer === "NONE") return null;
    return templateNames.includes(answer) ? answer : null;
  } catch {
    return null;
  }
}

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
    const header = ["单号", "标题", "支付公司", "支付日期", "费用类型名称", "金额", "消费事由"];
    const sample = [
      ["B25001295", "万达项目2010房间第2月房租4500元（3月）", "北京百胜星联科技有限公司", "2025-03-28", "差旅费/长期租房", 4500.00, "万达项目2010房间第2月房租4500元"],
      ["B25001433", "支付2025年4月1日—4月30日房租+物业+2月电费", "上海百胜软件股份有限公司深圳分公司", "2025-03-26", "行政费/房租及物业", 34520.36, "支付2025年4月1日—4月30日房租+物业+2月电费"],
      ["B25001210", "2025年4月办公区房租租金", "上海百胜软件股份有限公司", "2025-05-09", "行政费/房租及物业", 447121.35, "2025年4月办公区房租租金"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...sample]);
    ws["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 24 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, "费用导入模板");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", 'attachment; filename="fee_import_template.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  });

  app.post("/api/import-fee", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const isCSV = req.file.originalname?.toLowerCase().endsWith(".csv") ||
        req.file.mimetype === "text/csv" || req.file.mimetype === "application/csv";
      let workbook: XLSX.WorkBook;
      if (isCSV) {
        const csvStr = req.file.buffer.toString("utf-8").replace(/^\uFEFF/, "");
        workbook = XLSX.read(csvStr, { type: "string" });
      } else {
        workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      }
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false });

      let imported = 0;
      let skipped = 0;
      let newEntities = 0;
      let newTemplates = 0;

      const entityCache: Record<string, number> = {};
      const templateCache: Record<string, number | null> = {};

      for (const row of rows) {
        const feeCode = String(row["单号"] || row["费用编号"] || row["feeCode"] || "").trim();
        const feeName = String(row["标题"] || row["费用名称"] || row["feeName"] || "").trim();
        const entityName = String(row["支付公司"] || row["entity"] || "").trim();
        const feeDate = String(row["支付日期"] || row["费用发生日期"] || row["feeDate"] || "").trim();
        const feeTypeName = String(row["费用类型名称"] || row["category"] || "").trim();
        const totalAmount = String(row["金额"] || row["总金额"] || row["totalAmount"] || "0");
        const sourceRef = String(row["消费事由"] || row["来源单据号"] || row["sourceRef"] || "").trim();

        if (!feeCode || !feeName) { skipped++; continue; }

        const existing = await storage.getFeeByCode(feeCode);
        if (existing) { skipped++; continue; }

        // Resolve entity (find or auto-create from 支付公司)
        let entityId: number;
        if (entityName) {
          if (entityCache[entityName] !== undefined) {
            entityId = entityCache[entityName];
          } else {
            let entity = await storage.getEntityByName(entityName);
            if (!entity) {
              const allEntities = await storage.getEntities();
              const nextCode = `E${String(allEntities.length + 1).padStart(3, "0")}`;
              entity = await storage.createEntity({ code: nextCode, name: entityName, remark: null });
              newEntities++;
            }
            entityCache[entityName] = entity.id;
            entityId = entity.id;
          }
        } else {
          skipped++; continue;
        }

        // Resolve template via AI match or substring match, then auto-create
        let templateId: number | null = null;
        if (feeTypeName) {
          if (templateCache[feeTypeName] !== undefined) {
            templateId = templateCache[feeTypeName];
          } else {
            // First try existing substring match
            let template = await storage.getRuleTemplateByName(feeTypeName);
            if (!template) {
              // Try AI matching
              const allTemplates = await storage.getRuleTemplates();
              const templateNames = allTemplates.map(t => t.name);
              const aiMatch = await matchCategoryWithAI(feeTypeName, templateNames);
              if (aiMatch) {
                template = allTemplates.find(t => t.name === aiMatch);
              }
            }
            if (!template) {
              // Auto-create new template
              template = await storage.createRuleTemplate({
                name: feeTypeName,
                defaultMonths: 12,
                debitAccountId: null,
                creditAccountId: null,
              });
              newTemplates++;
            }
            templateCache[feeTypeName] = template.id;
            templateId = template.id;
          }
        }

        const template = templateId ? await storage.getRuleTemplate(templateId) : null;
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
          sourceSystem: null,
          amortMonths,
          startMonth,
          endMonth,
          debitAccountId: template?.debitAccountId || null,
          creditAccountId: template?.creditAccountId || null,
          amortConfigured: false,
        });
        imported++;
      }

      res.json({ imported, skipped, total: rows.length, newEntities, newTemplates });
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
