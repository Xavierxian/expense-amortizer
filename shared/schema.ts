import { pgTable, text, varchar, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const entities = pgTable("entities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  remark: text("remark"),
});

export const insertEntitySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  remark: z.string().nullable().optional(),
});
export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type Entity = typeof entities.$inferSelect;

export const accounts = pgTable("accounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
});

export const insertAccountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
});
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

export const ruleTemplates = pgTable("rule_templates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  defaultMonths: integer("default_months").notNull().default(12),
  method: varchar("method", { length: 20 }).notNull().default("monthly"),
  debitAccountId: integer("debit_account_id").references(() => accounts.id),
  creditAccountId: integer("credit_account_id").references(() => accounts.id),
  remark: text("remark"),
});

export const insertRuleTemplateSchema = z.object({
  name: z.string().min(1),
  defaultMonths: z.number().min(1).default(12),
  method: z.string().default("monthly"),
  debitAccountId: z.number().nullable().optional(),
  creditAccountId: z.number().nullable().optional(),
  remark: z.string().nullable().optional(),
});
export type InsertRuleTemplate = z.infer<typeof insertRuleTemplateSchema>;
export type RuleTemplate = typeof ruleTemplates.$inferSelect;

export const fees = pgTable("fees", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  entityId: integer("entity_id").notNull().references(() => entities.id),
  feeCode: varchar("fee_code", { length: 100 }).notNull(),
  feeName: varchar("fee_name", { length: 500 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
  feeDate: varchar("fee_date", { length: 10 }).notNull(),
  sourceRef: varchar("source_ref", { length: 200 }),
  sourceSystem: varchar("source_system", { length: 100 }),
  department: varchar("department", { length: 200 }),
  amortMonths: integer("amort_months"),
  startMonth: varchar("start_month", { length: 7 }),
  endMonth: varchar("end_month", { length: 7 }),
  debitAccountId: integer("debit_account_id").references(() => accounts.id),
  creditAccountId: integer("credit_account_id").references(() => accounts.id),
  amortConfigured: boolean("amort_configured").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFeeSchema = z.object({
  entityId: z.number(),
  feeCode: z.string().min(1),
  feeName: z.string().min(1),
  totalAmount: z.string(),
  feeDate: z.string(),
  sourceRef: z.string().nullable().optional(),
  sourceSystem: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  amortMonths: z.number().nullable().optional(),
  startMonth: z.string().nullable().optional(),
  endMonth: z.string().nullable().optional(),
  debitAccountId: z.number().nullable().optional(),
  creditAccountId: z.number().nullable().optional(),
  amortConfigured: z.boolean().default(false),
});
export type InsertFee = z.infer<typeof insertFeeSchema>;
export type Fee = typeof fees.$inferSelect;

export const amortizationEntries = pgTable("amortization_entries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  feeId: integer("fee_id").notNull().references(() => fees.id),
  month: varchar("month", { length: 7 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  cumulativeAmount: numeric("cumulative_amount", { precision: 18, scale: 2 }).notNull(),
  remainingAmount: numeric("remaining_amount", { precision: 18, scale: 2 }).notNull(),
  voucherGenerated: boolean("voucher_generated").default(false).notNull(),
});

export const insertAmortizationEntrySchema = z.object({
  feeId: z.number(),
  month: z.string(),
  amount: z.string(),
  cumulativeAmount: z.string(),
  remainingAmount: z.string(),
  voucherGenerated: z.boolean().default(false),
});
export type InsertAmortizationEntry = z.infer<typeof insertAmortizationEntrySchema>;
export type AmortizationEntry = typeof amortizationEntries.$inferSelect;

export const vouchers = pgTable("vouchers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  entityId: integer("entity_id").notNull().references(() => entities.id),
  voucherNo: varchar("voucher_no", { length: 50 }).notNull().unique(),
  voucherDate: varchar("voucher_date", { length: 10 }).notNull(),
  month: varchar("month", { length: 7 }).notNull(),
  summary: text("summary").notNull(),
  department: varchar("department", { length: 200 }),
  debitAccountCode: varchar("debit_account_code", { length: 50 }).notNull(),
  debitAccountName: varchar("debit_account_name", { length: 200 }).notNull(),
  creditAccountCode: varchar("credit_account_code", { length: 50 }).notNull(),
  creditAccountName: varchar("credit_account_name", { length: 200 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  feeId: integer("fee_id").notNull().references(() => fees.id),
  entryId: integer("entry_id").notNull().references(() => amortizationEntries.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVoucherSchema = z.object({
  entityId: z.number(),
  voucherNo: z.string(),
  voucherDate: z.string(),
  month: z.string(),
  summary: z.string(),
  department: z.string().nullable().optional(),
  debitAccountCode: z.string(),
  debitAccountName: z.string(),
  creditAccountCode: z.string(),
  creditAccountName: z.string(),
  amount: z.string(),
  feeId: z.number(),
  entryId: z.number(),
});
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type Voucher = typeof vouchers.$inferSelect;

export type AmortizationEntryWithDetails = AmortizationEntry & {
  feeName: string;
  feeCode: string;
  entityId: number;
  entityName?: string;
  department?: string;
  debitAccountName?: string;
  creditAccountName?: string;
  debitAccountCode?: string;
  creditAccountCode?: string;
};

export type DashboardStats = {
  totalFees: number;
  pendingAmort: number;
  currentMonthAmount: string;
  generatedVouchers: number;
  ruleTemplateCount: number;
  entityCount: number;
};
