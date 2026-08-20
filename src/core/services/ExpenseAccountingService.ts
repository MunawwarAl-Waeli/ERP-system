// import Expense from "@core/database/models/Expense";
// import { JournalService } from "./JournalService";

// export const ExpenseAccountingService = {
//   createExpenseEntry: async (expense: Expense) => {
//     const lines = [
//       {
//         accountId: expense.expenseAccountId, // من حساب المصروفات
//         debit: expense.amount,
//         credit: 0,
//       },
//       {
//         accountId: expense.paymentAccountId, // إلى حساب الصندوق/البنك
//         debit: 0,
//         credit: expense.amount,
//       },
//     ];

//     return JournalService.createEntry({
//       date: expense.expenseDate,
//       description: `مصروف: ${expense.description || "بدون بيان"}`,
//       lines,
//       referenceType: "expense",
//       referenceId: expense.id,
//       createdBy: expense.createdBy,
//     });
//   },
// };
