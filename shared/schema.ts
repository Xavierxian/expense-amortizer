import { pgTable, text, varchar, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

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

export const fees = pgTable("fees", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  feeCode: varchar("fee_code", { length: 100 }).notNull().unique(),
  feeName: varchar("fee_name", { length: 500 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
  feeDate: varchar("fee_date", { length: 10 }).notNull(),
  sourceRef: varchar("source_ref", { length: 200 }),
  sourceSystem: varchar("source_system", { length: 100 }),
  hasRule: boolean("has_rule").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFeeSchema = z.object({
  feeCode: z.string().min(1),
  feeName: z.string().min(1),
  totalAmount: z.string(),
  feeDate: z.string(),
  sourceRef: z.string().nullable().optional(),
  sourceSystem: z.string().nullable().optional(),
  hasRule: z.boolean().default(false),
});
export type InsertFee = z.infer<typeof insertFeeSchema>;
export type Fee = typeof fees.$inferSelect;

export const amortizationRules = pgTable("amortization_rules", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  feeId: integer("fee_id").notNull().references(() => fees.id),
  startMonth: varchar("start_month", { length: 7 }).notNull(),
  endMonth: varchar("end_month", { length: 7 }).notNull(),
  method: varchar("method", { length: 20 }).notNull().default("monthly"),
  debitAccountId: integer("debit_account_id").references(() => accounts.id),
  creditAccountId: integer("credit_account_id").references(() => accounts.id),
  remark: text("remark"),
});

export const insertAmortizationRuleSchema = z.object({
  feeId: z.number(),
  startMonth: z.string().min(1),
  endMonth: z.string().min(1),
  method: z.string().default("monthly"),
  debitAccountId: z.number().nullable().optional(),
  creditAccountId: z.number().nullable().optional(),
  remark: z.string().nullable().optional(),
});
export type InsertAmortizationRule = z.infer<typeof insertAmortizationRuleSchema>;
export type AmortizationRule = typeof amortizationRules.$inferSelect;

export const amortizationEntries = pgTable("amortization_entries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  feeId: integer("fee_id").notNull().references(() => fees.id),
  ruleId: integer("rule_id").notNull().references(() => amortizationRules.id),
  month: varchar("month", { length: 7 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  cumulativeAmount: numeric("cumulative_amount", { precision: 18, scale: 2 }).notNull(),
  remainingAmount: numeric("remaining_amount", { precision: 18, scale: 2 }).notNull(),
  voucherGenerated: boolean("voucher_generated").default(false).notNull(),
});

export const insertAmortizationEntrySchema = z.object({
  feeId: z.number(),
  ruleId: z.number(),
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
  voucherNo: varchar("voucher_no", { length: 50 }).notNull().unique(),
  voucherDate: varchar("voucher_date", { length: 10 }).notNull(),
  month: varchar("month", { length: 7 }).notNull(),
  summary: text("summary").notNull(),
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
  voucherNo: z.string(),
  voucherDate: z.string(),
  month: z.string(),
  summary: z.string(),
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
  debitAccountName?: string;
  creditAccountName?: string;
  debitAccountCode?: string;
  creditAccountCode?: string;
};

export type DashboardStats = {
  totalFees: number;
  pendingRules: number;
  currentMonthAmount: string;
  generatedVouchers: number;
};
