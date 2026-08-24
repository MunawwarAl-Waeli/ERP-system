import { database, Expense } from "@core/database";
import { Q } from "@nozbe/watermelondb";
import { JournalService, JournalLineInput } from "@core/services/JournalService";
import { AccountingSettingsService } from "@core/services/AccountingSettingsService";

const expensesCollection = database.get<Expense>("expenses");

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
    expensesCollection
      .query(Q.sortBy("expense_date", Q.desc))
      .observe(),

  getExpenses: async (startDate?: Date, endDate?: Date, expenseAccountId?: string): Promise<Expense[]> => {
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
        item.expenseDate = data.expenseDate;
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
        date: data.expenseDate,
        description: `مصروف تشغيلي: ${data.description || "بدون بيان"} (${data.referenceNumber || expense.id})`,
        lines,
        referenceType: "expense",
        referenceId: expense.id,
        createdBy: data.createdBy,
      });

      return expense;
    });
  },

  /**
   * حساب إجمالي المصروفات وملخص النسب حسب الحسابات
   */
  getExpensesSummary: async (startDate?: Date, endDate?: Date): Promise<{ total: number; breakdown: ExpenseSummaryItem[] }> => {
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

  deleteExpense: async (id: string) => {
    return database.write(async () => {
      const expense = await expensesCollection.find(id);
      await expense.markAsDeleted();
    });
  },
};
