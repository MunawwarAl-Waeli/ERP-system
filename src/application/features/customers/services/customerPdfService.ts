import { generatePDF } from "react-native-html-to-pdf";
import ReactNativeBlobUtil from "react-native-blob-util";
import { Platform } from "react-native";

import { CustomerData } from "@core/types/sales/customer";
import { LedgerTransactionItem } from "../repositories/customerRepository";
import { CURRENCY_SYMBOL } from "@core/constants";
import { useSettingsStore } from "@application/features/settings/store/useSettingsStore";

// ========================================
// 1. Types & Interfaces
// ========================================

export interface StoreProfile {
  name?: string;
  address?: string;
  phone?: string;
  gstNumber?: string;
  logoUrl?: string;
}

export type CustomerWithAddress = CustomerData & {
  address?: string;
};

export interface GenerateLedgerOptions {
  customer: CustomerWithAddress;
  transactions: LedgerTransactionItem[];
  totalBalance: number;
  periodLabel?: string;
  storeProfile?: StoreProfile;
}

// ========================================
// 2. Helpers & Utility Functions
// ========================================

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatAmount = (value: unknown): string =>
  safeNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatCurrency = (value: unknown): string =>
  `<span dir="ltr" class="number-ltr">${formatAmount(value)} ${escapeHtml(
    CURRENCY_SYMBOL,
  )}</span>`;

const formatDate = (value: unknown): string => {
  if (!value) return "-";
  const date = new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const getBalanceStatus = (balance: number): string => {
  if (balance > 0) return "مستحق على العميل (دين)";
  if (balance < 0) return "رصيد لصالح العميل (مقدم)";
  return "الحساب متوازن";
};

const getBalanceColor = (balance: number): string => {
  if (balance > 0) return "#d97706";
  if (balance < 0) return "#059669";
  return "#475569";
};

// ========================================
// 3. HTML Ledger Template Generator
// ========================================

export const generateLedgerHtml = ({
  customer,
  transactions,
  totalBalance,
  periodLabel = "كامل الحركات المسجلة",
  storeProfile,
}: GenerateLedgerOptions): string => {
  const store = storeProfile || useSettingsStore.getState().storeProfile || {};

  const companyName = store.name?.trim() || "اسم الشركة";
  const companyAddress = store.address?.trim();
  const companyPhone = store.phone?.trim();
  const companyGst = store.gstNumber?.trim();

  const balance = safeNumber(totalBalance);
  const balanceColor = getBalanceColor(balance);
  const balanceStatus = getBalanceStatus(balance);

  const totalDebit = transactions.reduce(
    (sum, item) => sum + safeNumber(item.debit),
    0,
  );

  const totalCredit = transactions.reduce(
    (sum, item) => sum + safeNumber(item.credit),
    0,
  );

  const now = new Date();
  const reportDate = formatDate(now);
  const reportNumber = `CL-${now.valueOf()}`;

  const rowsHtml = transactions.length
    ? transactions
        .map(
          (tx, index) => `
          <tr class="${index % 2 === 1 ? "row-alt" : ""}">
            <td class="col-date">${formatDate(tx.date)}</td>
            <td class="col-desc">${escapeHtml(tx.description || "-")}</td>
            <td class="col-debit">${
              safeNumber(tx.debit) > 0 ? formatAmount(tx.debit) : "-"
            }</td>
            <td class="col-credit">${
              safeNumber(tx.credit) > 0 ? formatAmount(tx.credit) : "-"
            }</td>
            <td class="col-running">${formatAmount(tx.runningBalance)}</td>
          </tr>
        `,
        )
        .join("")
    : `
      <tr>
        <td colspan="5" class="empty-row">
          لا توجد حركات مالية مسجلة خلال هذه الفترة
        </td>
      </tr>
    `;

  const companyContactItems = [
    companyAddress ? `<span>${escapeHtml(companyAddress)}</span>` : "",
    companyPhone
      ? `<span>هاتف: <span dir="ltr">${escapeHtml(companyPhone)}</span></span>`
      : "",
    companyGst ? `<span>الرقم الضريبي: ${escapeHtml(companyGst)}</span>` : "",
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>كشف حساب - ${escapeHtml(customer.name)}</title>
  
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    @page {
      size: A4;
      margin: 12mm 10mm;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      color: #1e293b;
      background: #ffffff;
      font-size: 13px;
      line-height: 1.5;
      padding: 10px;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 3px solid #0f766e;
      margin-bottom: 14px;
    }

    .brand-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 46px;
      height: 46px;
      background: #0f766e;
      color: #ffffff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      line-height: 46px;
    }

    .company-name {
      font-size: 20px;
      font-weight: bold;
      color: #0f766e;
    }

    .company-sub {
      font-size: 11px;
      color: #64748b;
    }

    .company-info {
      text-align: left;
      font-size: 11px;
      color: #334155;
      line-height: 1.7;
    }

    /* Report Title Section */
    .report-header {
      text-align: center;
      margin-bottom: 14px;
    }

    .report-title {
      font-size: 22px;
      font-weight: bold;
      color: #0f172a;
    }

    .report-period {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }

    .meta-bar {
      display: flex;
      justify-content: space-between;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 14px;
      margin-bottom: 14px;
      font-size: 12px;
      font-weight: 500;
      color: #334155;
    }

    /* Info Cards */
    .info-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 14px;
    }

    .customer-card {
      flex: 1.2;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 14px;
    }

    .card-title {
      font-size: 12px;
      font-weight: bold;
      color: #0f766e;
      margin-bottom: 6px;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 4px;
    }

    .customer-name {
      font-size: 16px;
      font-weight: bold;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .customer-meta {
      font-size: 11.5px;
      color: #475569;
    }

    .summary-card {
      flex: 1;
      display: flex;
      gap: 8px;
    }

    .stat-box {
      flex: 1;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 6px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .stat-label {
      font-size: 11px;
      font-weight: bold;
      color: #64748b;
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 14px;
      font-weight: bold;
      direction: ltr;
      unicode-bidi: isolate;
    }

    .debit-val { color: #b91c1c; }
    .credit-val { color: #15803d; }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      table-layout: fixed;
    }

    thead th {
      background: #0f766e;
      color: #ffffff;
      font-weight: bold;
      font-size: 12px;
      padding: 9px 6px;
      text-align: center;
      border: 1px solid #0f766e;
    }

    tbody td {
      padding: 9px 6px;
      border: 1px solid #cbd5e1;
      font-size: 11.5px;
      font-weight: 500;
      vertical-align: middle;
      word-wrap: break-word;
    }

    tbody tr {
      page-break-inside: avoid;
    }

    .row-alt {
      background: #f8fafc;
    }

    .col-date { width: 16%; text-align: center; }
    .col-desc { width: 34%; text-align: right; }
    .col-debit { width: 16%; text-align: center; color: #b91c1c; font-weight: bold; direction: ltr; unicode-bidi: isolate; }
    .col-credit { width: 16%; text-align: center; color: #15803d; font-weight: bold; direction: ltr; unicode-bidi: isolate; }
    .col-running { width: 18%; text-align: center; font-weight: bold; direction: ltr; unicode-bidi: isolate; }

    .empty-row {
      text-align: center;
      color: #94a3b8;
      padding: 20px;
    }

    /* Balance Summary Box */
    .balance-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-right: 6px solid ${balanceColor};
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

    .balance-title {
      font-size: 13px;
      font-weight: bold;
      color: #475569;
    }

    .balance-amount {
      font-size: 24px;
      font-weight: bold;
      color: ${balanceColor};
      margin: 4px 0;
    }

    .balance-status-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: bold;
      color: ${balanceColor};
      background: #ffffff;
      padding: 3px 12px;
      border-radius: 14px;
      border: 1px solid #cbd5e1;
    }

    /* Signatures */
    .signature-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      page-break-inside: avoid;
    }

    .signature-card {
      width: 40%;
      text-align: center;
      font-size: 11px;
      font-weight: bold;
      color: #475569;
    }

    .signature-line {
      border-bottom: 1px dashed #94a3b8;
      margin-top: 28px;
    }

    /* Footer */
    .footer {
      border-top: 1px solid #e2e8f0;
      margin-top: 18px;
      padding-top: 8px;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
    }

    .number-ltr {
      direction: ltr;
      display: inline-block;
    }
  </style>
</head>
<body>

  <!-- Company Header -->
  <div class="header">
    <div class="brand-section">
      <div class="brand-logo">
        ${escapeHtml(companyName.charAt(0) || "ش")}
      </div>
      <div>
        <div class="company-name">${escapeHtml(companyName)}</div>
        <div class="company-sub">كشف حساب مالي معتمد</div>
      </div>
    </div>
    
    <div class="company-info">
      ${companyContactItems.join(" | ") || "بيانات الشركة"}
    </div>
  </div>

  <!-- Report Title -->
  <div class="report-header">
    <h1 class="report-title">كشف حساب عميل</h1>
    <div class="report-period">${escapeHtml(periodLabel)}</div>
  </div>

  <!-- Report Meta -->
  <div class="meta-bar">
    <span><strong>مرجع الكشف:</strong> ${reportNumber}</span>
    <span><strong>تاريخ الإصدار:</strong> ${reportDate}</span>
  </div>

  <!-- Customer & Overview Info -->
  <div class="info-grid">
    <div class="customer-card">
      <div class="card-title">بيانات العميل</div>
      <div class="customer-name">${escapeHtml(customer.name)}</div>
      <div class="customer-meta">
        <div><strong>الهاتف:</strong> <span dir="ltr">${escapeHtml(
          customer.phone || "غير مسجل",
        )}</span></div>
        ${
          customer.address
            ? `<div><strong>العنوان:</strong> ${escapeHtml(
                customer.address,
              )}</div>`
            : ""
        }
      </div>
    </div>

    <div class="summary-card">
      <div class="stat-box">
        <div class="stat-label">إجمالي المدين</div>
        <div class="stat-value debit-val">${formatAmount(totalDebit)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">إجمالي الدائن</div>
        <div class="stat-value credit-val">${formatAmount(totalCredit)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">عدد الحركات</div>
        <div class="stat-value" style="color: #0f172a;">${
          transactions.length
        }</div>
      </div>
    </div>
  </div>

  <!-- Transactions Table -->
  <table>
    <thead>
      <tr>
        <th>التاريخ</th>
        <th>البيان / تفاصيل الحركة</th>
        <th>مدين (عليك)</th>
        <th>دائن (لك)</th>
        <th>الرصيد المتبقي</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <!-- Current Balance Card -->
  <div class="balance-box">
    <div class="balance-title">الرصيد النهائي المستحق</div>
    <div class="balance-amount">${formatCurrency(Math.abs(balance))}</div>
    <div class="balance-status-badge">${balanceStatus}</div>
  </div>

  <!-- Signatures -->
  <div class="signature-grid">
    <div class="signature-card">
      توقيع الموظف المسؤول
      <div class="signature-line"></div>
    </div>
    <div class="signature-card">
      اعتماد ومصادقة العميل
      <div class="signature-line"></div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    ${escapeHtml(
      companyName,
    )} • تم استخراج هذا المستند إلكترونياً بتاريخ ${reportDate}
  </div>

</body>
</html>`;
};

// ========================================
// 4. PDF Generation Service
// ========================================

export const customerPdfService = {
  async generatePdf(
    customer: CustomerWithAddress,
    transactions: LedgerTransactionItem[],
    totalBalance: number,
    periodLabel = "كامل الحركات المسجلة",
  ): Promise<string> {
    try {
      const html = generateLedgerHtml({
        customer,
        transactions,
        totalBalance,
        periodLabel,
      });

      const fileName = `Ledger_${customer.name.replace(
        /\s+/g,
        "_",
      )}_${Date.now()}`;

      const pdf = await generatePDF({
        html,
        fileName,
        directory: "Documents",
      });

      if (!pdf.filePath) {
        throw new Error("فشل إنشاء ملف الـ PDF: المسار غير صالح");
      }

      return pdf.filePath;
    } catch (error) {
      console.error("[CustomerPdfService] Error generating PDF:", error);
      throw error;
    }
  },

  async shareLedgerPdf(
    customer: CustomerWithAddress,
    transactions: LedgerTransactionItem[],
    totalBalance: number,
    periodLabel = "كامل الحركات المسجلة",
  ): Promise<void> {
    const filePath = await this.generatePdf(
      customer,
      transactions,
      totalBalance,
      periodLabel,
    );

    if (Platform.OS === "android") {
      await ReactNativeBlobUtil.android.actionViewIntent(
        filePath,
        "application/pdf",
      );
    } else if (Platform.OS === "ios") {
      await ReactNativeBlobUtil.ios.openDocument(filePath);
    } else {
      throw new Error(`النظام الحالي غير مدعوم: ${Platform.OS}`);
    }
  },

  getPdfForPreview(
    customer: CustomerWithAddress,
    transactions: LedgerTransactionItem[],
    totalBalance: number,
    periodLabel = "كامل الحركات المسجلة",
  ): Promise<string> {
    return this.generatePdf(customer, transactions, totalBalance, periodLabel);
  },
};
