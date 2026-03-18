import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAccountSchema, insertFeeSchema, insertRuleTemplateSchema, insertEntitySchema } from "@shared/schema";
import multer from "multer";
import * as XLSX from "xlsx";
import OpenAI from "openai";

const upload = multer({ storage: multer.memoryStorage() });

// 初始化 OpenAI 客户端（兼容 DeepSeek 等第三方接口）
const aiClient = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
});

/**
 * 调用 AI 生成凭证摘要
 * @param feeNames 费用名称列表
 * @param month 摊销月份
 * @param fallback 默认备用摘要
 */
const AI_MODELS = ["DeepSeek-V3.2", "deepseek-v3-250324"];

async function generateSummaryWithAI(
  feeNames: string[],
  month: string,
  fallback: string
): Promise<string> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const prompt = [
    `以下是${month}月份费用摊销的费用名称列表：`,
    feeNames.map((n, i) => `${i + 1}. ${n}`).join("\n"),
    "",
    `请为以上费用生成一条简洁的凭证摘要，要求：`,
    `1. 概括费用类别和主要内容，不要列举具体费用名称`,
    `2. 包含"${month}摊销"`,
    `3. 长度不超过50个字`,
    `4. 只返回摘要文字，不要加解释和引号`,
  ].join("\n");

  for (const model of AI_MODELS) {
    try {
      const response = await aiClient.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.3,
      });
      const result = response.choices[0]?.message?.content?.trim();
      if (result) {
        if (model !== AI_MODELS[0]) {
          console.log(`[AI摘要] 主模型不可用，已切换到备用模型 ${model}`);
        }
        return result;
      }
    } catch (e) {
      console.warn(`[AI摘要] 模型 ${model} 调用失败:`, (e as Error).message);
    }
  }

  console.warn("[AI摘要] 所有模型均失败，使用默认摘要");
  return fallback;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeExcelDate(raw: string): string {
  if (!raw) return raw;
  const s = raw.trim();
  // Excel serial number (pure integer like "46014")
  if (/^\d{4,6}$/.test(s)) {
    const serial = parseInt(s);
    // Excel's epoch is Dec 30, 1899 (accounting for leap year bug)
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  // M/D/YY or M/D/YYYY format
  const slash = s.split("/");
  if (slash.length === 3) {
    let yr = slash[2].trim();
    if (yr.length === 2) yr = "20" + yr;
    return `${yr}-${slash[0].trim().padStart(2, "0")}-${slash[1].trim().padStart(2, "0")}`;
  }
  return s;
}

function feeeDateToMonth(feeDate: string): string {
  if (!feeDate) return getCurrentMonth();
  const normalized = normalizeExcelDate(feeDate);
  const parts = normalized.split("-");
  if (parts.length >= 2 && parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, "0")}`;
  return getCurrentMonth();
}

function addMonths(yearMonth: string, count: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const totalMonths = y * 12 + (m - 1) + (count - 1);
  const newY = Math.floor(totalMonths / 12);
  const newM = (totalMonths % 12) + 1;
  return `${newY}-${String(newM).padStart(2, "0")}`;
}

/**
 * 从费用名称中解析日期区间，自动推断摊销起止月和月数
 * 支持格式: YYYY.MM.DD-YYYY.MM.DD / YYYY.MM-YYYY.MM 等
 * 规则: 开始日期>=16日则取下月，否则取当月; 结束日期直接取所在月
 */
function parseDateRangeFromName(feeName: string): { startMonth: string; endMonth: string; amortMonths: number } | null {
  if (!feeName) return null;
  const datePattern = /(\d{4})[.\/-](\d{1,2})(?:[.\/-](\d{1,2}))?/g;
  const matches: Array<{ year: number; month: number; day: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = datePattern.exec(feeName)) !== null) {
    const year = parseInt(m[1]);
    const month = parseInt(m[2]);
    const day = m[3] ? parseInt(m[3]) : 1;
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      matches.push({ year, month, day });
    }
  }
  if (matches.length < 2) return null;
  const first = matches[0];
  const last = matches[matches.length - 1];
  // 开始月: >=16日取下月
  let sy = first.year, sm = first.month;
  if (first.day >= 16) {
    sm += 1;
    if (sm > 12) { sm = 1; sy++; }
  }
  const ey = last.year, em = last.month;
  const startStr = `${sy}-${String(sm).padStart(2, "0")}`;
  const endStr = `${ey}-${String(em).padStart(2, "0")}`;
  const totalMonths = (ey - sy) * 12 + (em - sm) + 1;
  if (totalMonths < 1) return null;
  return { startMonth: startStr, endMonth: endStr, amortMonths: totalMonths };
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

async function generateEntriesForFee(feeId: number): Promise<number> {
  const fee = await storage.getFee(feeId);
  if (!fee || !fee.startMonth || !fee.endMonth || !fee.amortMonths) return 0;
  await storage.deleteEntriesByFeeId(feeId);
  const months = getMonthsBetween(fee.startMonth, fee.endMonth);
  const totalAmount = parseFloat(fee.totalAmount);
  const amortEntries = calculateAmortization(totalAmount, months);
  let cumulative = 0;
  for (const entry of amortEntries) {
    cumulative += entry.amount;
    const remaining = Math.round((totalAmount - cumulative) * 100) / 100;
    await storage.createEntry({
      feeId,
      month: entry.month,
      amount: entry.amount.toFixed(2),
      cumulativeAmount: cumulative.toFixed(2),
      remainingAmount: remaining.toFixed(2),
      voucherGenerated: false,
    });
  }
  return amortEntries.length;
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
    const { templateId, ...rest } = req.body;
    const parsed = insertFeeSchema.safeParse(rest);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      let data = { ...parsed.data };
      const template = templateId ? await storage.getRuleTemplate(Number(templateId)) : null;
      if (template) {
        const startMonth = data.startMonth || feeeDateToMonth(data.feeDate || "");
        const amortMonths = data.amortMonths || template.defaultMonths || 12;
        const endMonth = addMonths(startMonth, amortMonths);
        data = {
          ...data,
          amortMonths,
          startMonth,
          endMonth,
          debitAccountId: data.debitAccountId ?? template.debitAccountId ?? null,
          creditAccountId: data.creditAccountId ?? template.creditAccountId ?? null,
        };
      }
      let fee = await storage.createFee(data);
      if (template && fee.startMonth && fee.endMonth) {
        await generateEntriesForFee(fee.id);
        fee = (await storage.updateFee(fee.id, { amortConfigured: true })) ?? fee;
      }
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
    const header = ["单号", "标题", "支付公司", "支付日期", "费用类型名称", "金额", "消费事由", "承担部门"];
    const sample = [
      ["B25001295", "万达项目2010房间第2月房租4500元（3月）", "北京百胜星联科技有限公司", "2025-03-28", "差旅费/长期租房", 4500.00, "万达项目2010房间第2月房租4500元", "行政部"],
      ["B25001433", "支付2025年4月1日—4月30日房租+物业+2月电费", "上海百胜软件股份有限公司深圳分公司", "2025-03-26", "行政费/房租及物业", 34520.36, "支付2025年4月1日—4月30日房租+物业+2月电费", "深圳分公司"],
      ["B25001210", "2025年4月办公区房租租金", "上海百胜软件股份有限公司", "2025-05-09", "行政费/房租及物业", 447121.35, "2025年4月办公区房租租金", "行政部"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...sample]);
    ws["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 24 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 30 }, { wch: 16 }];
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
        const feeDate = normalizeExcelDate(String(row["支付日期"] || row["费用发生日期"] || row["feeDate"] || "").trim());
        const feeTypeName = String(row["费用类型名称"] || row["category"] || "").trim();
        const totalAmount = String(row["金额"] || row["总金额"] || row["totalAmount"] || "0");
        const sourceRef = String(row["消费事由"] || row["来源单据号"] || row["sourceRef"] || "").trim();
        const department = String(row["承担部门"] || row["department"] || "").trim();

        if (!feeCode || !feeName) { skipped++; continue; }

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

        // Resolve template via substring match, then auto-create if not found
        let templateId: number | null = null;
        if (feeTypeName) {
          if (templateCache[feeTypeName] !== undefined) {
            templateId = templateCache[feeTypeName];
          } else {
            let template = await storage.getRuleTemplateByName(feeTypeName);
            if (!template) {
              template = await storage.createRuleTemplate({
                name: feeTypeName,
                defaultMonths: 12,
                method: "monthly",
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
        // 优先从费用名称中解析日期区间
        const parsedRange = parseDateRangeFromName(feeName);
        const startMonth = parsedRange?.startMonth || feeeDateToMonth(feeDate);
        const amortMonths = parsedRange?.amortMonths || template?.defaultMonths || null;
        const endMonth = parsedRange?.endMonth || (amortMonths ? addMonths(startMonth, amortMonths) : null);

        const newFee = await storage.createFee({
          entityId,
          feeCode,
          feeName,
          totalAmount,
          feeDate,
          sourceRef: sourceRef || null,
          sourceSystem: null,
          department: department || null,
          feeType: feeTypeName || null,
          amortMonths,
          startMonth,
          endMonth,
          debitAccountId: template?.debitAccountId || null,
          creditAccountId: template?.creditAccountId || null,
          amortConfigured: false,
        });

        if (amortMonths && startMonth && endMonth) {
          await generateEntriesForFee(newFee.id);
          await storage.updateFee(newFee.id, { amortConfigured: true });
        }
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

      const { amortMonths, debitAccountId, creditAccountId, startMonth: reqStartMonth } = req.body;
      if (!amortMonths || amortMonths < 1) {
        return res.status(400).json({ message: "Amortization months must be at least 1" });
      }

      const startMonth = (reqStartMonth && /^\d{4}-\d{2}$/.test(reqStartMonth))
        ? reqStartMonth
        : feeeDateToMonth(fee.feeDate);
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

      const entriesCount = await generateEntriesForFee(id);

      res.json({ success: true, entriesCount, startMonth, endMonth });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/batch-generate-amort", async (_req, res) => {
    try {
      const allFees = await storage.getFees();
      const unconfigured = allFees.filter(f => !f.amortConfigured && f.amortMonths && f.startMonth && f.endMonth);
      let processed = 0;
      for (const fee of unconfigured) {
        await generateEntriesForFee(fee.id);
        await storage.updateFee(fee.id, { amortConfigured: true });
        processed++;
      }
      res.json({ success: true, processed });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // 重新生成指定费用的摊销明细（用于已删除摊销后重新生成）
  app.post("/api/regenerate-fee-amort/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const fee = await storage.getFee(id);
      
      if (!fee) {
        return res.status(404).json({ message: "费用不存在" });
      }
      
      if (!fee.amortMonths || !fee.startMonth || !fee.endMonth) {
        return res.status(400).json({ message: "费用未配置摊销规则" });
      }
      
      // 检查是否有关联的未删除凭证
      const entries = await storage.getEntriesByFeeId(id);
      const entriesWithVoucher = entries.filter(e => e.voucherGenerated);
      if (entriesWithVoucher.length > 0) {
        return res.status(400).json({ message: "该费用存在已生成凭证的摊销，请先删除凭证" });
      }
      
      // 删除现有摊销（如果有）并重新生成
      await storage.deleteEntriesByFeeId(id);
      const entriesCount = await generateEntriesForFee(id);
      
      // 确保 amortConfigured 为 true
      if (!fee.amortConfigured) {
        await storage.updateFee(id, { amortConfigured: true });
      }
      
      res.json({ success: true, entriesCount, message: "摊销明细已重新生成" });
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

      // 按承担部门+借方科目+贷方科目分组汇总
      type EntryWithDetails = typeof ungenerated[0];
      const groupKey = (e: EntryWithDetails) => `${e.department || ''}|${e.debitAccountCode}|${e.creditAccountCode}`;
      const groups = new Map<string, EntryWithDetails[]>();
      
      for (const entry of ungenerated) {
        const key = groupKey(entry);
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(entry);
      }

      const generated: any[] = [];

      for (const [key, groupEntries] of Array.from(groups.entries())) {
        const [department] = key.split('|');
        const totalAmount = groupEntries.reduce((sum: number, e: EntryWithDetails) => sum + Number(e.amount), 0);
        const firstEntry = groupEntries[0];

        // 使用时间戳+随机数确保凭证号唯一
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const voucherNo = `PZ-${month.replace("-", "")}-${timestamp}${random}`;
        const voucherDate = `${month}-01`;

        // 构建默认备用摘要
        const feeNames = Array.from(new Set(groupEntries.map((e: EntryWithDetails) => e.feeName)));
        const summaryFeeNames = feeNames.slice(0, 3).join("、");
        const moreCount = feeNames.length > 3 ? `等${feeNames.length}笔` : "";
        const fallbackSummary = `${summaryFeeNames}${moreCount} ${month} 摊销`;

        // 调用 AI 生成更语义化的摘要，失败时回退至默认摘要
        const summary = await generateSummaryWithAI(feeNames, month, fallbackSummary);

        const voucher = await storage.createVoucher({
          entityId,
          voucherNo,
          voucherDate,
          month,
          summary,
          department: department || null,
          debitAccountCode: firstEntry.debitAccountCode || "",
          debitAccountName: firstEntry.debitAccountName || "",
          creditAccountCode: firstEntry.creditAccountCode || "",
          creditAccountName: firstEntry.creditAccountName || "",
          amount: totalAmount.toFixed(2),
          feeId: firstEntry.feeId,
          entryId: firstEntry.id,
        });

        // 标记该组所有摊销记录为已生成凭证
        for (const entry of groupEntries) {
          await storage.markEntryVoucherGenerated(entry.id);
        }

        generated.push(voucher);
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

  // 删除凭证 API - 删除凭证并重置对应摊销的 voucherGenerated 状态
  app.delete("/api/vouchers/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const voucher = await storage.getVoucherByEntryId(id);
      if (!voucher) {
        return res.status(404).json({ message: "凭证不存在" });
      }
      
      // 删除凭证
      await storage.deleteVoucher(voucher.id);
      
      // 重置对应摊销明细的凭证生成状态
      await storage.unmarkEntryVoucherGenerated(voucher.entryId);
      
      res.json({ success: true, message: "凭证已删除，可重新生成" });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // 删除摊销明细 API - 只有未生成凭证的才能删除
  app.delete("/api/entries/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const entry = await storage.getEntry(id);
      
      if (!entry) {
        return res.status(404).json({ message: "摊销明细不存在" });
      }
      
      // 检查是否已生成凭证
      if (entry.voucherGenerated) {
        return res.status(400).json({ message: "该摊销已生成凭证，请先删除凭证后再删除摊销" });
      }
      
      await storage.deleteEntry(id);
      res.json({ success: true, message: "摊销明细已删除" });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  return httpServer;
}
