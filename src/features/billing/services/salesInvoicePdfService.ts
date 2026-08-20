// services/salesInvoicePdfService.ts
import { generatePDF } from "react-native-html-to-pdf";
import ReactNativeBlobUtil from "react-native-blob-util";
import { Platform } from "react-native";
import { formatDateTime, formatDate } from "@shared/utils/date";
import { CURRENCY_SYMBOL } from "@core/constants";

// ========================================
// 1. الأنواع (Types)
// ========================================

export interface SalesInvoicePdfItem {
  productName: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
}

export interface SalesInvoicePdfData {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  gstNumber?: string;
  invoiceNumber: string;
  invoiceDate: Date | number;
  items: SalesInvoicePdfItem[];
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  paymentType: "cash" | "credit" | "partial";
  customerName?: string;
  customerPhone?: string;
  status: "draft" | "approved" | "cancelled" | "paid" | "partial";
}

// ========================================
// 2. دالة تنسيق العملة
// ========================================

const formatCurrency = (amount: number): string =>
  `${CURRENCY_SYMBOL}${amount.toFixed(2)}`;

// ========================================
// 3. دالة إنشاء HTML للفاتورة
// ========================================

const generateInvoiceHtml = (data: SalesInvoicePdfData): string => {
  // 3.1 بناء صفوف البنود
  const itemsHtml = data.items
    .map(
      (item, index) => `
      <tr class="${index % 2 === 1 ? "row-alt" : ""}">
        <td class="cell cell-center">${index + 1}</td>
        <td class="cell">${item.productName}</td>
        <td class="cell cell-center">${item.quantity}${
        item.unit ? ` ${item.unit}` : ""
      }</td>
        <td class="cell cell-right">${formatCurrency(item.unitPrice)}</td>
        <td class="cell cell-right cell-bold">${formatCurrency(item.total)}</td>
      </tr>`,
    )
    .join("");

  // 3.2 تحديد حالة الفاتورة
  const isCancelled = data.status === "cancelled";
  const isDraft = data.status === "draft";

  // 3.3 ألوان طريقة الدفع
  const paymentColors: Record<string, string> = {
    cash: "#2e7d32",
    credit: "#e65100",
    partial: "#1565c0",
  };
  const paymentColor = paymentColors[data.paymentType] || "#2e7d32";

  // 3.4 حالة الفاتورة (للـ CSS)
  const statusClass = isCancelled
    ? "status-cancelled"
    : isDraft
    ? "status-draft"
    : "status-completed";

  // ========================================
  // 4. قالب HTML الكامل
  // ========================================

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      color: #1a1a1a;
      background: #fff;
      padding: 24px 20px;
    }
    .invoice { max-width: 420px; margin: 0 auto; }

    /* Header */
    .header {
      text-align: center;
      padding-bottom: 18px;
      margin-bottom: 18px;
      border-bottom: 3px solid #2e7d32;
    }
    .store-name {
      font-size: 24px;
      font-weight: 800;
      color: #2e7d32;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .store-detail { font-size: 11px; color: #666; line-height: 1.6; }
    .gst-badge {
      display: inline-block;
      background: #e8f5e9;
      color: #2e7d32;
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      margin-top: 6px;
      letter-spacing: 0.3px;
    }

    /* Invoice title row */
    .invoice-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .invoice-label {
      font-size: 18px;
      font-weight: 800;
      color: #1a1a1a;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .status {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-completed { background: #e8f5e9; color: #2e7d32; }
    .status-draft { background: #fff3e0; color: #e65100; }
    .status-cancelled { background: #ffebee; color: #c62828; }

    /* Bill meta */
    .meta-grid {
      display: flex;
      gap: 12px;
      margin: 14px 0 18px;
    }
    .meta-box {
      flex: 1;
      background: #f8f9fa;
      border-radius: 8px;
      padding: 10px 12px;
      border-left: 3px solid #e0e0e0;
    }
    .meta-label {
      font-size: 9px;
      color: #999;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 600;
      color: #333;
    }
    .meta-box.payment { border-left-color: ${paymentColor}; }
    .meta-box.payment .meta-value { color: ${paymentColor}; }

    /* Customer */
    .customer-card {
      background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
      padding: 12px 14px;
      border-radius: 8px;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .customer-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #1565c0;
      color: white;
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .customer-name { font-size: 14px; font-weight: 700; color: #1a1a1a; }
    .customer-phone { font-size: 11px; color: #666; }

    /* Items table */
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    .items-table thead th {
      background: #2e7d32;
      color: white;
      padding: 10px 8px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
    }
    .items-table thead th:first-child { border-radius: 6px 0 0 0; }
    .items-table thead th:last-child { border-radius: 0 6px 0 0; }
    .cell { padding: 10px 8px; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
    .cell-center { text-align: center; }
    .cell-right { text-align: right; }
    .cell-bold { font-weight: 600; }
    .row-alt { background: #fafafa; }

    /* Summary */
    .summary {
      background: #f8f9fa;
      border-radius: 0 0 6px 6px;
      padding: 14px 16px;
      border-top: 2px solid #e0e0e0;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 12px;
      color: #666;
    }
    .summary-row span:last-child { font-weight: 500; color: #333; }
    .discount-row { color: #2e7d32 !important; }
    .discount-row span { color: #2e7d32 !important; }
    .total-divider {
      border: none;
      border-top: 2px dashed #2e7d32;
      margin: 10px 0;
    }
    .grand-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }
    .grand-total-label { font-size: 15px; font-weight: 800; color: #1a1a1a; }
    .grand-total-value {
      font-size: 22px;
      font-weight: 800;
      color: #2e7d32;
    }
    ${
      isCancelled
        ? ".grand-total-value { color: #c62828; text-decoration: line-through; }"
        : ""
    }
    .payment-pill {
      display: inline-block;
      background: ${paymentColor}15;
      color: ${paymentColor};
      padding: 5px 18px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.5px;
      margin-top: 10px;
    }

    /* Footer */
    .footer {
      text-align: center;
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px dashed #ccc;
    }
    .footer-thanks {
      font-size: 13px;
      font-weight: 600;
      color: #2e7d32;
      margin-bottom: 4px;
    }
    .footer-date { font-size: 9px; color: #aaa; }
  </style>
</head>
<body>
  <div class="invoice">
    <!-- Store Header -->
    <div class="header">
      <div class="store-name">${data.storeName || "Store Name"}</div>
      <div class="store-detail">
        ${data.storeAddress ? `${data.storeAddress}<br>` : ""}
        ${data.storePhone ? `Ph: ${data.storePhone}` : ""}
      </div>
      ${
        data.gstNumber
          ? `<div class="gst-badge">GSTIN: ${data.gstNumber}</div>`
          : ""
      }
    </div>

    <!-- Invoice Title & Status -->
    <div class="invoice-title">
      <span class="invoice-label">Invoice</span>
      <span class="status ${statusClass}">${data.status}</span>
    </div>

    <!-- Meta Grid -->
    <div class="meta-grid">
      <div class="meta-box">
        <div class="meta-label">Invoice Number</div>
        <div class="meta-value">#${data.invoiceNumber}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Date</div>
        <div class="meta-value">${formatDateTime(data.invoiceDate)}</div>
      </div>
      <div class="meta-box payment">
        <div class="meta-label">Payment</div>
        <div class="meta-value">${data.paymentType.toUpperCase()}</div>
      </div>
    </div>

    ${
      data.customerName
        ? `
    <!-- Customer -->
    <div class="customer-card">
      <div class="customer-avatar">${data.customerName
        .charAt(0)
        .toUpperCase()}</div>
      <div>
        <div class="customer-name">${data.customerName}</div>
        ${
          data.customerPhone
            ? `<div class="customer-phone">Ph: ${data.customerPhone}</div>`
            : ""
        }
      </div>
    </div>`
        : ""
    }

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 28px;">#</th>
          <th>Item</th>
          <th style="width: 50px; text-align: center;">Qty</th>
          <th style="width: 65px; text-align: right;">Rate</th>
          <th style="width: 75px; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <!-- Summary -->
    <div class="summary">
      <div class="summary-row">
        <span>Subtotal (${data.items.length} ${
    data.items.length === 1 ? "item" : "items"
  })</span>
        <span>${formatCurrency(data.subtotal)}</span>
      </div>
      ${
        data.discountTotal > 0
          ? `
      <div class="summary-row discount-row">
        <span>Discount</span>
        <span>-${formatCurrency(data.discountTotal)}</span>
      </div>`
          : ""
      }
      <hr class="total-divider">
      <div class="grand-total">
        <span class="grand-total-label">Grand Total</span>
        <span class="grand-total-value">${formatCurrency(
          data.grandTotal,
        )}</span>
      </div>
      <div style="text-align: center;">
        <span class="payment-pill">${data.paymentType.toUpperCase()}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-thanks">Thank you for your purchase!</div>
      <div class="footer-date">Generated on ${formatDate(new Date())}</div>
    </div>
  </div>
</body>
</html>`;
};

// ========================================
// 5. خدمة PDF للمبيعات
// ========================================

export const salesInvoicePdfService = {
  /**
   * Generate PDF file from invoice data
   * @returns Path to the generated PDF file
   */
  async generatePdf(data: SalesInvoicePdfData): Promise<string> {
    const html = generateInvoiceHtml(data);

    const pdf = await generatePDF({
      html,
      fileName: `Invoice_${data.invoiceNumber}`,
      directory: "Documents",
      width: 400,
      height: 600,
      padding: 0,
    });
    if (!pdf.filePath) {
      throw new Error("Failed to generate PDF");
    }

    return pdf.filePath;
  },

  /**
   * Generate plain text invoice for sharing as fallback
   */
  generateTextInvoice(data: SalesInvoicePdfData): string {
    const lines: string[] = [];
    lines.push(data.storeName);
    if (data.storeAddress) {
      lines.push(data.storeAddress);
    }
    if (data.storePhone) {
      lines.push(`Ph: ${data.storePhone}`);
    }
    if (data.gstNumber) {
      lines.push(`GST: ${data.gstNumber}`);
    }
    lines.push("─".repeat(30));
    lines.push(`Invoice: #${data.invoiceNumber}`);
    lines.push(`Date: ${formatDateTime(data.invoiceDate)}`);
    lines.push(`Payment: ${data.paymentType.toUpperCase()}`);
    if (data.customerName) {
      lines.push(`Customer: ${data.customerName}`);
    }
    lines.push("─".repeat(30));

    data.items.forEach((item, i) => {
      lines.push(`${i + 1}. ${item.productName}`);
      lines.push(
        `   ${item.quantity} × ${formatCurrency(
          item.unitPrice,
        )} = ${formatCurrency(item.total)}`,
      );
    });

    lines.push("─".repeat(30));
    lines.push(`Subtotal: ${formatCurrency(data.subtotal)}`);
    if (data.discountTotal > 0) {
      lines.push(`Discount: -${formatCurrency(data.discountTotal)}`);
    }
    lines.push(`Grand Total: ${formatCurrency(data.grandTotal)}`);
    lines.push("─".repeat(30));
    lines.push("Thank you for your purchase!");

    return lines.join("\n");
  },

  /**
   * Generate PDF and open it in the device's native PDF viewer
   */
  async sharePdf(data: SalesInvoicePdfData): Promise<void> {
    const filePath = await this.generatePdf(data);

    if (Platform.OS === "android") {
      await ReactNativeBlobUtil.android.actionViewIntent(
        filePath,
        "application/pdf",
      );
    } else {
      await ReactNativeBlobUtil.ios.openDocument(filePath);
    }
  },

  /**
   * Generate PDF and return path for preview
   */
  getPdfForPreview(data: SalesInvoicePdfData): Promise<string> {
    return this.generatePdf(data);
  },
};
