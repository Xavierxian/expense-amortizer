import { db } from "./db";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  entities, accounts, fees, ruleTemplates, amortizationEntries, vouchers,
  type InsertEntity, type Entity,
  type InsertAccount, type Account,
  type InsertFee, type Fee,
  type InsertRuleTemplate, type RuleTemplate,
  type InsertAmortizationEntry, type AmortizationEntry,
  type InsertVoucher, type Voucher,
  type AmortizationEntryWithDetails,
  type DashboardStats,
} from "@shared/schema";

export interface IStorage {
  getEntities(): Promise<Entity[]>;
  getEntity(id: number): Promise<Entity | undefined>;
  getEntityByName(name: string): Promise<Entity | undefined>;
  createEntity(data: InsertEntity): Promise<Entity>;
  updateEntity(id: number, data: Partial<InsertEntity>): Promise<Entity | undefined>;
  deleteEntity(id: number): Promise<boolean>;

  getAccounts(): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  createAccount(data: InsertAccount): Promise<Account>;
  updateAccount(id: number, data: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(id: number): Promise<boolean>;

  getRuleTemplates(): Promise<RuleTemplate[]>;
  getRuleTemplate(id: number): Promise<RuleTemplate | undefined>;
  getRuleTemplateByName(name: string): Promise<RuleTemplate | undefined>;
  createRuleTemplate(data: InsertRuleTemplate): Promise<RuleTemplate>;
  updateRuleTemplate(id: number, data: Partial<InsertRuleTemplate>): Promise<RuleTemplate | undefined>;
  deleteRuleTemplate(id: number): Promise<boolean>;

  getFees(entityId?: number): Promise<Fee[]>;
  getFee(id: number): Promise<Fee | undefined>;
  getFeeByCode(code: string): Promise<Fee | undefined>;
  createFee(data: InsertFee): Promise<Fee>;
  updateFee(id: number, data: Partial<InsertFee>): Promise<Fee | undefined>;
  deleteFee(id: number): Promise<boolean>;

  getEntriesByMonth(month: string, entityId?: number): Promise<AmortizationEntryWithDetails[]>;
  getEntriesByFeeId(feeId: number): Promise<AmortizationEntry[]>;
  getEntry(id: number): Promise<AmortizationEntry | undefined>;
  createEntry(data: InsertAmortizationEntry): Promise<AmortizationEntry>;
  deleteEntry(id: number): Promise<boolean>;
  deleteEntriesByFeeId(feeId: number): Promise<void>;
  markEntryVoucherGenerated(entryId: number): Promise<void>;
  unmarkEntryVoucherGenerated(entryId: number): Promise<void>;

  getVouchersByMonth(month: string, entityId?: number): Promise<Voucher[]>;
  getVoucher(id: number): Promise<Voucher | undefined>;
  createVoucher(data: InsertVoucher): Promise<Voucher>;
  deleteVoucher(id: number): Promise<boolean>;
  getVoucherByEntryId(entryId: number): Promise<Voucher | undefined>;
  getVoucherCount(): Promise<number>;

  // 根据凭证匹配条件查找关联的摊销明细
  getEntriesByVoucherMatch(
    month: string,
    entityId: number,
    department: string | null,
    debitAccountCode: string,
    creditAccountCode: string
  ): Promise<AmortizationEntry[]>;

  getDashboardStats(currentMonth: string): Promise<DashboardStats>;

  // 批量删除所有业务数据（保留基础配置）
  clearAllData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getEntities(): Promise<Entity[]> {
    return db.select().from(entities).orderBy(entities.code);
  }

  async getEntity(id: number): Promise<Entity | undefined> {
    const [e] = await db.select().from(entities).where(eq(entities.id, id));
    return e;
  }

  async getEntityByName(name: string): Promise<Entity | undefined> {
    const all = await db.select().from(entities);
    return all.find(e => e.name.trim() === name.trim());
  }

  async createEntity(data: InsertEntity): Promise<Entity> {
    const [e] = await db.insert(entities).values(data).returning();
    return e;
  }

  async updateEntity(id: number, data: Partial<InsertEntity>): Promise<Entity | undefined> {
    const [e] = await db.update(entities).set(data).where(eq(entities.id, id)).returning();
    return e;
  }

  async deleteEntity(id: number): Promise<boolean> {
    const result = await db.delete(entities).where(eq(entities.id, id)).returning();
    return result.length > 0;
  }

  async getAccounts(): Promise<Account[]> {
    return db.select().from(accounts).orderBy(accounts.code);
  }

  async getAccount(id: number): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account;
  }

  async createAccount(data: InsertAccount): Promise<Account> {
    const [account] = await db.insert(accounts).values(data).returning();
    return account;
  }

  async updateAccount(id: number, data: Partial<InsertAccount>): Promise<Account | undefined> {
    const [account] = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning();
    return account;
  }

  async deleteAccount(id: number): Promise<boolean> {
    const result = await db.delete(accounts).where(eq(accounts.id, id)).returning();
    return result.length > 0;
  }

  async getRuleTemplates(): Promise<RuleTemplate[]> {
    return db.select().from(ruleTemplates).orderBy(ruleTemplates.name);
  }

  async getRuleTemplate(id: number): Promise<RuleTemplate | undefined> {
    const [t] = await db.select().from(ruleTemplates).where(eq(ruleTemplates.id, id));
    return t;
  }

  async getRuleTemplateByName(name: string): Promise<RuleTemplate | undefined> {
    const all = await db.select().from(ruleTemplates);
    const matches = all.filter(t => name.includes(t.name));
    if (matches.length === 0) return undefined;
    return matches.reduce((best, t) => t.name.length > best.name.length ? t : best);
  }

  async createRuleTemplate(data: InsertRuleTemplate): Promise<RuleTemplate> {
    const [t] = await db.insert(ruleTemplates).values(data).returning();
    return t;
  }

  async updateRuleTemplate(id: number, data: Partial<InsertRuleTemplate>): Promise<RuleTemplate | undefined> {
    const [t] = await db.update(ruleTemplates).set(data).where(eq(ruleTemplates.id, id)).returning();
    return t;
  }

  async deleteRuleTemplate(id: number): Promise<boolean> {
    const result = await db.delete(ruleTemplates).where(eq(ruleTemplates.id, id)).returning();
    return result.length > 0;
  }

  async getFees(entityId?: number): Promise<Fee[]> {
    if (entityId) {
      return db.select().from(fees).where(eq(fees.entityId, entityId)).orderBy(desc(fees.createdAt));
    }
    return db.select().from(fees).orderBy(desc(fees.createdAt));
  }

  async getFee(id: number): Promise<Fee | undefined> {
    const [fee] = await db.select().from(fees).where(eq(fees.id, id));
    return fee;
  }

  async getFeeByCode(code: string): Promise<Fee | undefined> {
    const [fee] = await db.select().from(fees).where(eq(fees.feeCode, code));
    return fee;
  }

  async createFee(data: InsertFee): Promise<Fee> {
    const [fee] = await db.insert(fees).values(data).returning();
    return fee;
  }

  async updateFee(id: number, data: Partial<InsertFee>): Promise<Fee | undefined> {
    const [fee] = await db.update(fees).set(data).where(eq(fees.id, id)).returning();
    return fee;
  }

  async deleteFee(id: number): Promise<boolean> {
    const result = await db.delete(fees).where(eq(fees.id, id)).returning();
    return result.length > 0;
  }

  async getEntriesByMonth(month: string, entityId?: number): Promise<AmortizationEntryWithDetails[]> {
    let query = db
      .select({
        id: amortizationEntries.id,
        feeId: amortizationEntries.feeId,
        month: amortizationEntries.month,
        amount: amortizationEntries.amount,
        cumulativeAmount: amortizationEntries.cumulativeAmount,
        remainingAmount: amortizationEntries.remainingAmount,
        voucherGenerated: amortizationEntries.voucherGenerated,
        feeName: fees.feeName,
        feeCode: fees.feeCode,
        entityId: fees.entityId,
        department: fees.department,
        feeType: fees.feeType,
        feeDebitAccountId: fees.debitAccountId,
        feeCreditAccountId: fees.creditAccountId,
      })
      .from(amortizationEntries)
      .innerJoin(fees, eq(amortizationEntries.feeId, fees.id))
      .where(
        entityId
          ? and(eq(amortizationEntries.month, month), eq(fees.entityId, entityId))
          : eq(amortizationEntries.month, month)
      )
      .orderBy(fees.feeCode);

    const rows = await query;

    const entityCache: Record<number, Entity | undefined> = {};
    const result: AmortizationEntryWithDetails[] = [];
    for (const row of rows) {
      let debitAccountName: string | undefined;
      let creditAccountName: string | undefined;
      let debitAccountCode: string | undefined;
      let creditAccountCode: string | undefined;
      if (row.feeDebitAccountId) {
        const [a] = await db.select().from(accounts).where(eq(accounts.id, row.feeDebitAccountId));
        if (a) { debitAccountName = a.name; debitAccountCode = a.code; }
      }
      if (row.feeCreditAccountId) {
        const [a] = await db.select().from(accounts).where(eq(accounts.id, row.feeCreditAccountId));
        if (a) { creditAccountName = a.name; creditAccountCode = a.code; }
      }
      if (!(row.entityId in entityCache)) {
        entityCache[row.entityId] = await this.getEntity(row.entityId);
      }
      result.push({
        id: row.id,
        feeId: row.feeId,
        month: row.month,
        amount: row.amount,
        cumulativeAmount: row.cumulativeAmount,
        remainingAmount: row.remainingAmount,
        voucherGenerated: row.voucherGenerated,
        feeName: row.feeName,
        feeCode: row.feeCode,
        feeType: row.feeType || undefined,
        entityId: row.entityId,
        entityName: entityCache[row.entityId]?.name,
        department: row.department || undefined,
        debitAccountName,
        creditAccountName,
        debitAccountCode,
        creditAccountCode,
      });
    }
    return result;
  }

  async getEntriesByFeeId(feeId: number): Promise<AmortizationEntry[]> {
    return db.select().from(amortizationEntries).where(eq(amortizationEntries.feeId, feeId)).orderBy(amortizationEntries.month);
  }

  async getEntry(id: number): Promise<AmortizationEntry | undefined> {
    const [entry] = await db.select().from(amortizationEntries).where(eq(amortizationEntries.id, id));
    return entry;
  }

  async createEntry(data: InsertAmortizationEntry): Promise<AmortizationEntry> {
    const [entry] = await db.insert(amortizationEntries).values(data).returning();
    return entry;
  }

  async deleteEntriesByFeeId(feeId: number): Promise<void> {
    await db.delete(amortizationEntries).where(eq(amortizationEntries.feeId, feeId));
  }

  async deleteEntry(id: number): Promise<boolean> {
    const result = await db.delete(amortizationEntries).where(eq(amortizationEntries.id, id)).returning();
    return result.length > 0;
  }

  async markEntryVoucherGenerated(entryId: number): Promise<void> {
    await db.update(amortizationEntries).set({ voucherGenerated: true }).where(eq(amortizationEntries.id, entryId));
  }

  async unmarkEntryVoucherGenerated(entryId: number): Promise<void> {
    await db.update(amortizationEntries).set({ voucherGenerated: false }).where(eq(amortizationEntries.id, entryId));
  }

  async getVouchersByMonth(month: string, entityId?: number): Promise<Voucher[]> {
    if (entityId) {
      return db.select().from(vouchers).where(and(eq(vouchers.month, month), eq(vouchers.entityId, entityId))).orderBy(vouchers.voucherNo);
    }
    return db.select().from(vouchers).where(eq(vouchers.month, month)).orderBy(vouchers.voucherNo);
  }

  async getVoucher(id: number): Promise<Voucher | undefined> {
    const [voucher] = await db.select().from(vouchers).where(eq(vouchers.id, id));
    return voucher;
  }

  async createVoucher(data: InsertVoucher): Promise<Voucher> {
    const [voucher] = await db.insert(vouchers).values(data).returning();
    return voucher;
  }

  async deleteVoucher(id: number): Promise<boolean> {
    const result = await db.delete(vouchers).where(eq(vouchers.id, id)).returning();
    return result.length > 0;
  }

  async getVoucherByEntryId(entryId: number): Promise<Voucher | undefined> {
    const [voucher] = await db.select().from(vouchers).where(eq(vouchers.entryId, entryId));
    return voucher;
  }

  async getVoucherCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(vouchers);
    return Number(result[0]?.count ?? 0);
  }

  async getDashboardStats(currentMonth: string): Promise<DashboardStats> {
    const [feeCount] = await db.select({ count: sql<number>`count(*)` }).from(fees);
    const [pendingCount] = await db.select({ count: sql<number>`count(*)` }).from(fees).where(eq(fees.amortConfigured, false));
    const [templateCount] = await db.select({ count: sql<number>`count(*)` }).from(ruleTemplates);
    const [entityCount] = await db.select({ count: sql<number>`count(*)` }).from(entities);

    const monthEntries = await db.select({
      total: sql<string>`coalesce(sum(${amortizationEntries.amount}::numeric), 0)`,
    }).from(amortizationEntries).where(eq(amortizationEntries.month, currentMonth));

    const [voucherCount] = await db.select({ count: sql<number>`count(*)` }).from(vouchers);

    return {
      totalFees: Number(feeCount?.count ?? 0),
      pendingAmort: Number(pendingCount?.count ?? 0),
      currentMonthAmount: monthEntries[0]?.total ?? "0",
      generatedVouchers: Number(voucherCount?.count ?? 0),
      ruleTemplateCount: Number(templateCount?.count ?? 0),
      entityCount: Number(entityCount?.count ?? 0),
    };
  }

  async clearAllData(): Promise<void> {
    // 按外键依赖顺序删除：vouchers -> amortizationEntries -> fees
    await db.delete(vouchers);
    await db.delete(amortizationEntries);
    await db.delete(fees);
  }

  async getEntriesByVoucherMatch(
    month: string,
    entityId: number,
    department: string | null,
    debitAccountCode: string,
    creditAccountCode: string
  ): Promise<AmortizationEntry[]> {
    // 先根据code查找对应的account id
    const [debitAccount] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, debitAccountCode));
    const [creditAccount] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, creditAccountCode));

    if (!debitAccount || !creditAccount) {
      return [];
    }

    // 通过月份、主体、部门、科目ID组合查找关联的摊销明细
    const result = await db
      .select({
        id: amortizationEntries.id,
        feeId: amortizationEntries.feeId,
        month: amortizationEntries.month,
        amount: amortizationEntries.amount,
        cumulativeAmount: amortizationEntries.cumulativeAmount,
        remainingAmount: amortizationEntries.remainingAmount,
        voucherGenerated: amortizationEntries.voucherGenerated,
      })
      .from(amortizationEntries)
      .innerJoin(fees, eq(amortizationEntries.feeId, fees.id))
      .where(
        and(
          eq(amortizationEntries.month, month),
          eq(fees.entityId, entityId),
          eq(amortizationEntries.voucherGenerated, true),
          department
            ? eq(fees.department, department)
            : sql`${fees.department} IS NULL`,
          eq(fees.debitAccountId, debitAccount.id),
          eq(fees.creditAccountId, creditAccount.id)
        )
      );
    return result as AmortizationEntry[];
  }
}

export const storage = new DatabaseStorage();
