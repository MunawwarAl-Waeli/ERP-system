import { database, Expense } from "src/database";
import JournalEntry from "src/database/models/JournalEntry";
import { Q } from "@nozbe/watermelondb";
import { JournalService, JournalLineInput } from "@core/services/JournalService";
import { AccountingSettingsService } from "@core/services/AccountingSettingsService";
import { REFERENCE_TYPES } from "@core/constants";

export interface CreateExpenseServiceInput {
  expenseAccountId: string;
  paymentAccountId?: string;
  amount: number;
  description?: string;
  referenceNumber?: string;
  expenseDate: string; // YYYY-MM-DD
  createdBy?: string;
}

export interface ExpenseData {
  id: string;
  expenseAccountId: string;
  paymentAccountId: string;
  amount: number;
  description: string;
  referenceNumber?: string;
  expenseDate: string;
  createdBy: string;
  createdAt: number;
}

export interface ExpenseSummaryItem {
  categoryId: string;
  categoryName: string;
  totalAmount: number;
  percentage: number;
}

export interface ExpenseService {
  create(input: CreateExpenseServiceInput): Promise<ExpenseData>;
  cancel(id: string): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  getById(id: string): Promise<ExpenseData | null>;
  getAll(): Promise<ExpenseData[]>;
  getByDateRange(
    start?: string,
    end?: string,
    expenseAccountId?: string,
  ): Promise<ExpenseData[]>;
  getSummary(
    start?: string,
    end?: string,
  ): Promise<{ total: number; breakdown: ExpenseSummaryItem[] }>;
}

export class ExpenseServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpenseServiceError";
  }
}

export class ExpenseServiceImpl implements ExpenseService {
  private readonly expenses = database.get<Expense>("expenses");
  private readonly journals = database.get<JournalEntry>("journal_entries");

  async create(input: CreateExpenseServiceInput): Promise<ExpenseData> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new ExpenseServiceError("مبلغ المصروف يجب أن يكون أكبر من الصفر.");
    }
    if (!input.expenseAccountId?.trim()) {
      throw new ExpenseServiceError("يجب تحديد حساب المصروف.");
    }
    const settings = await AccountingSettingsService.getSettings();
    const paymentAccount = input.paymentAccountId || settings.cashAccountId;
    if (!paymentAccount) {
      throw new ExpenseServiceError(
        "لم يتم تحديد حساب الدفع (الصندوق/البنك).",
      );
    }
    const expenseDateTs = this.toTimestamp(input.expenseDate);

    return database.write(async () => {
      const expense = await this.expenses.create((item) => {
        item.expenseAccountId = input.expenseAccountId;
        item.paymentAccountId = paymentAccount;
        item.amount = input.amount;
        item.description = input.description || "";
        item.referenceNumber = input.referenceNumber || null;
        item.expenseDate = expenseDateTs;
        item.createdBy = input.createdBy || "system";
      });

      const lines: JournalLineInput[] = [
        {
          accountId: input.expenseAccountId,
          debit: input.amount,
          credit: 0,
        },
        {
          accountId: paymentAccount,
          debit: 0,
          credit: input.amount,
        },
      ];

      await JournalService.createEntry({
        entryDate: expenseDateTs,
        description: `مصروف تشغيلي: ${input.description || "بدون بيان"} (${
          input.referenceNumber || expense.id
        })`,
        lines,
        referenceType: REFERENCE_TYPES.EXPENSE,
        referenceId: expense.id,
        createdBy: input.createdBy || "system",
        idempotencyKey: `expense:${expense.id}`,
      });

      return this.toData(expense);
    });
  }

  async cancel(id: string): Promise<void> {
    await this.deleteExpense(id);
  }

  async deleteExpense(id: string): Promise<void> {
    if (!id?.trim()) {
      throw new ExpenseServiceError("معرف المصروف مطلوب.");
    }
    return database.write(async () => {
      const expense = await this.expenses.find(id);
      const journals = await this.journals
        .query(
          Q.where("reference_type", REFERENCE_TYPES.EXPENSE),
          Q.where("reference_id", id),
        )
        .fetch();

      for (const journal of journals) {
        if (journal.status === "posted" && !journal.isReversed) {
          const reversal = await JournalService.prepareReverseEntry(
            journal,
            `عكس قيد مصروف: ${expense.description || expense.id}`,
            {
              createdBy: expense.createdBy || "system",
              idempotencyKey: `expense-reversal:${id}:${journal.id}`,
            },
            Date.now(),
          );
          await database.batch(...reversal.operations);
        }
      }
      await expense.markAsDeleted();
    });
  }

  async getById(id: string): Promise<ExpenseData | null> {
    try {
      const exp = await this.expenses.find(id);
      return this.toData(exp);
    } catch {
      return null;
    }
  }

  async getAll(): Promise<ExpenseData[]> {
    const rows = await this.expenses
      .query(Q.sortBy("expense_date", Q.desc))
      .fetch();
    return rows.map((r) => this.toData(r));
  }

  async getByDateRange(
    start?: string,
    end?: string,
    expenseAccountId?: string,
  ): Promise<ExpenseData[]> {
    const conditions: any[] = [Q.sortBy("expense_date", Q.desc)];
    if (expenseAccountId) {
      conditions.push(Q.where("expense_account_id", expenseAccountId));
    }
    if (start) {
      conditions.push(Q.where("expense_date", Q.gte(this.toTimestamp(start))));
    }
    if (end) {
      const endTs = this.toTimestamp(end) + 24 * 60 * 60 * 1000 - 1;
      conditions.push(Q.where("expense_date", Q.lte(endTs)));
    }
    const rows = await this.expenses.query(...conditions).fetch();
    return rows.map((r) => this.toData(r));
  }

  async getSummary(
    start?: string,
    end?: string,
  ): Promise<{ total: number; breakdown: ExpenseSummaryItem[] }> {
    const expenses = await this.getByDateRange(start, end);
    const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const map: { [key: string]: number } = {};
    for (const exp of expenses) {
      const accId = exp.expenseAccountId || "other";
      map[accId] = (map[accId] || 0) + (exp.amount || 0);
    }
    const breakdown: ExpenseSummaryItem[] = Object.keys(map).map((accId) => {
      const amount = map[accId];
      const percentage = total > 0 ? (amount / total) * 100 : 0;
      return {
        categoryId: accId,
        categoryName: `حساب مصروف (${accId})`,
        totalAmount: amount,
        percentage: parseFloat(percentage.toFixed(1)),
      };
    });
    return { total, breakdown };
  }

  private toTimestamp(dateStr: string): number {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr?.trim());
    if (!match) {
      throw new ExpenseServiceError(
        `صيغة التاريخ غير صالحة: ${dateStr}. الصيغة المطلوبة YYYY-MM-DD.`,
      );
    }
    return new Date(`${dateStr.trim()}T00:00:00.000Z`).getTime();
  }

  private toData(row: Expense): ExpenseData {
    return {
      id: row.id,
      expenseAccountId: row.expenseAccountId,
      paymentAccountId: row.paymentAccountId,
      amount: row.amount,
      description: row.description,
      referenceNumber: row.referenceNumber ?? undefined,
      expenseDate: new Date(row.expenseDate).toISOString().slice(0, 10),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    };
  }
}
