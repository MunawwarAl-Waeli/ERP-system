import { database, Expense } from "src/database";
import JournalEntry from "src/database/models/JournalEntry";
import { Q } from "@nozbe/watermelondb";
import { JournalService, JournalLineInput } from "@core/services/JournalService";
import { AccountingSettingsService } from "@core/services/AccountingSettingsService";
import { REFERENCE_TYPES } from "@core/constants";

const expensesCollection = database.get<Expense>("expenses");
const journalsCollection = database.get<JournalEntry>("journal_entries");

export interface CreateExpenseData {
  expenseAccountId: string;
  paymentAccountId?: string;
  amount: number;
  description?: string;
  referenceNumber?: string;
  expenseDate: Date;
  createdBy: string;
}

export interface ExpenseSummaryItem {
  categoryId: string;
  categoryName: string;
  totalAmount: number;
  percentage: number;
}

export const expenseRepository = {
  observeAll: () =>
    expensesCollection.query(Q.sortBy("expense_date", Q.desc)).observe(),

  getExpenses: async (
    startDate?: Date,
    endDate?: Date,
    expenseAccountId?: string,
  ): Promise<Expense[]> => {
    const queryConditions: any[] = [Q.sortBy("expense_date", Q.desc)];

    if (expenseAccountId) {
      queryConditions.push(Q.where("expense_account_id", expenseAccountId));
    }

    let expenses = await expensesCollection.query(...queryConditions).fetch();

    if (startDate) {
      expenses = expenses.filter((e) => new Date(e.expenseDate) >= startDate);
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      expenses = expenses.filter((e) => new Date(e.expenseDate) <= endOfDay);
    }

    return expenses;
  },

  /**
   * إنشاء مصروف جديد وتوليد القيد المحاسبي المزدوج التلقائي
   */
  createExpense: async (data: CreateExpenseData): Promise<Expense> => {
    if (data.amount <= 0) {
      throw new Error("مبلغ المصروف يجب أن يكون أكبر من الصفر");
    }

    const settings = await AccountingSettingsService.getSettings();
    const paymentAccount = data.paymentAccountId || settings.cashAccountId;

    if (!paymentAccount) {
      throw new Error("لم يتم تحديد حساب الدفع الافتراضي (الصندوق/البنك).");
    }

    if (!data.expenseAccountId) {
      throw new Error("يجب تحديد حساب المصروف.");
    }

    return database.write(async () => {
      // 1. إنشاء سجل المصروف
      const expense = await expensesCollection.create((item) => {
        item.expenseAccountId = data.expenseAccountId;
        item.paymentAccountId = paymentAccount;
        item.amount = data.amount;
        item.description = data.description || "";
        item.referenceNumber = data.referenceNumber || null;
        item.expenseDate = data.expenseDate.getTime();
        item.createdBy = data.createdBy || "system";
      });

      // 2. إعداد القيود المحاسبية الآلية (من مذكورين / حساب المصروف إلى حساب الصندوق أو البنك)
      const lines: JournalLineInput[] = [
        {
          accountId: data.expenseAccountId, // مدين (زيادة المصروفات)
          debit: data.amount,
          credit: 0,
        },
        {
          accountId: paymentAccount, // دائن (نقص النقدية/البنك)
          debit: 0,
          credit: data.amount,
        },
      ];

      await JournalService.createEntry({
        entryDate: data.expenseDate.getTime(),
        description: `مصروف تشغيلي: ${data.description || "بدون بيان"} (${
          data.referenceNumber || expense.id
        })`,
        lines,
        referenceType: REFERENCE_TYPES.EXPENSE,
        referenceId: expense.id,
        createdBy: data.createdBy,
        idempotencyKey: `expense:${expense.id}`,
      });

      return expense;
    });
  },

  /**
   * حساب إجمالي المصروفات وملخص النسب حسب الحسابات
   */
  getExpensesSummary: async (
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ total: number; breakdown: ExpenseSummaryItem[] }> => {
    const expenses = await expenseRepository.getExpenses(startDate, endDate);
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
  },

  /**
   * حذف/إلغاء مصروف مع عكس القيد المحاسبي المزدوج أولاً
   */
  deleteExpense: async (id: string) => {
    return database.write(async () => {
      const expense = await expensesCollection.find(id);
      const journals = await journalsCollection
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
  },

  cancelExpense: async (id: string) => expenseRepository.deleteExpense(id),
};
