import { database } from "src/database";
import Category from "src/database/models/Category";

import { Observable } from "rxjs";
import SalesInvoiceModel from "src/database/models/SalesInvoice";
import SalesInvoiceItemModel from "src/database/models/SalesInvoiceItem";
import ReceiptAllocation from "src/database/models/ReceiptAllocation";
import { Q } from "@nozbe/watermelondb";
export interface SalesInvoiceService {
  // Commands
  createDraft(input: CreateSalesInvoiceInput): Promise<SalesInvoiceData>;

  updateDraft(
    id: string,
    input: CreateSalesInvoiceInput,
  ): Promise<SalesInvoiceData>;

  post(command: PostSalesInvoiceCommand): Promise<SalesInvoiceData>;

  cancel(id: string, cancelledAt: string): Promise<SalesInvoiceData>;

  // Reactive reads (Ù„Ù„ÙˆØ§Ø¬Ù‡Ø© â€” Observables)
  observeAll(): Observable<SalesInvoiceModel[]>;
  observeItems(invoiceId: string): Observable<SalesInvoiceItemModel[]>;
  searchByInvoiceNumber(term: string): Observable<SalesInvoiceModel[]>;
}
import {
  DOCUMENT_PREFIXES,
  DOCUMENT_STATUSES,
  PAYMENT_TYPES,
  REFERENCE_TYPES,
  STOCK_MOVEMENT_TYPES,
} from "@core/constants";

import {
  CreateSalesInvoiceInput,
  PostSalesInvoiceInput,
  SalesInvoiceData,
} from "@core/types/sales/salesInvoice";

import { CreateJournalEntryInput } from "@core/types/accounting/journal";

import { SalesInvoiceRepository } from "@application/features/sales/repositories/SalesInvoiceRepository";
import { CustomerRepository } from "@application/features/customers/repositories/customerRepository";
import { ProductRepository } from "@application/features/inventory/repositories/productRepository";
import { InventoryRepository } from "@application/features/inventory/repositories/inventoryRepository";
import { JournalEntryRepository } from "@application/features/accounting/repositories/JournalEntryRepository";
import { AccountingSettingRepository } from "@application/features/accounting/repositories/AccountingSettingRepository";
import { AccountingPeriodRepository } from "@application/features/accounting/repositories/AccountingPeriodRepository";

import { UnitOfWork } from "@application/transactions/UnitOfWork";
import { DocumentNumberGenerator } from "@application/numbering/DocumentNumberGenerator";

import { calculateFIFOAllocation } from "@core/domain/inventory/fifoAllocation";

import { PostSalesInvoiceCommand } from "@core/types/sales/salesInvoice";

export class SalesInvoiceServiceImpl implements SalesInvoiceService {
  constructor(
    private readonly salesInvoiceRepository: SalesInvoiceRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly productRepository: ProductRepository,
    private readonly inventoryRepository: InventoryRepository,
    private readonly journalEntryRepository: JournalEntryRepository,
    private readonly accountingSettingRepository: AccountingSettingRepository,
    private readonly accountingPeriodRepository: AccountingPeriodRepository,
    private readonly documentNumberGenerator: DocumentNumberGenerator,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async createDraft(input: CreateSalesInvoiceInput): Promise<SalesInvoiceData> {
    this.validateCreateInput(input);

    if (input.idempotencyKey) {
      const existing = await this.salesInvoiceRepository.getByIdempotencyKey(
        input.idempotencyKey,
      );

      if (existing) {
        return existing;
      }
    }

    return this.unitOfWork.execute(() =>
      this.salesInvoiceRepository.createDraft(input),
    );
  }

  async updateDraft(
    id: string,
    input: CreateSalesInvoiceInput,
  ): Promise<SalesInvoiceData> {
    this.validateCreateInput(input);

    const invoice = await this.salesInvoiceRepository.getById(id);

    if (!invoice) {
      throw new Error(`Sales invoice not found: ${id}`);
    }

    if (invoice.status !== DOCUMENT_STATUSES.DRAFT) {
      throw new Error("Only draft sales invoices can be updated.");
    }

    if (invoice.isCancelled) {
      throw new Error("Cancelled sales invoices cannot be updated.");
    }

    return this.unitOfWork.execute(() =>
      this.salesInvoiceRepository.updateDraft(id, input),
    );
  }

  async post(command: PostSalesInvoiceCommand): Promise<SalesInvoiceData> {
    return this.unitOfWork.execute(async () => {
      const invoice = await this.salesInvoiceRepository.getById(
        command.salesInvoiceId,
      );

      if (!invoice) {
        throw new Error(`Sales invoice not found: ${command.salesInvoiceId}`);
      }

      if (invoice.isCancelled) {
        throw new Error("Cancelled sales invoices cannot be posted.");
      }

      if (invoice.status === DOCUMENT_STATUSES.POSTED) {
        return invoice;
      }

      if (invoice.status !== DOCUMENT_STATUSES.DRAFT) {
        throw new Error(
          `Sales invoice cannot be posted from status: ${invoice.status}`,
        );
      }

      await this.validateOpenPeriod(invoice.invoiceDate);

      const payment = this.validatePayment(invoice, command);

      const customer = await this.validateCustomer(invoice);

      const settings = await this.accountingSettingRepository.get();

      if (!settings) {
        throw new Error("Accounting settings have not been configured.");
      }

      const postedItems: PostSalesInvoiceInput["items"] = [];
      const productAccountsMap = new Map<
        string,
        { inv: string; sales: string; cogs: string }
      >();

      let totalCost = 0;

      for (const invoiceItem of invoice.items) {
        const product = await this.productRepository.getById(
          invoiceItem.productId,
        );

        if (!product) {
          throw new Error(`Product not found: ${invoiceItem.productId}`);
        }

        if (!product.isActive) {
          throw new Error(`Inactive product cannot be sold: ${product.name}`);
        }

        // âœ… Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† ÙˆØ¬ÙˆØ¯ Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ù…Ø­Ø§Ø³Ø¨ÙŠØ©
        // ✅ التحقق من الحسابات: من المنتج أولاً، وإن لم توجد نأخذها من الصنف (Category)
        let invAcc = product.inventoryAccountId;
        let salesAcc = product.salesAccountId;
        let cogsAcc = product.cogsAccountId;

        if ((!invAcc || !salesAcc || !cogsAcc) && product.categoryId) {
          const category = await database
            .get<Category>("categories")
            .find(product.categoryId)
            .catch(() => null);
          if (category) {
            invAcc = invAcc || category.inventoryAccountId || "";
            salesAcc = salesAcc || category.salesAccountId || "";
            cogsAcc = cogsAcc || category.cogsAccountId || "";
          }
        }

        if (!invAcc || !salesAcc || !cogsAcc) {
          throw new Error(
            `Product "${product.name}" and its category are missing accounting accounts. ` +
              `Set them on the product or its category.`,
          );
        }

        // ✅ وضع الحسابات التي تم حلها في الخريطة لاستخدامها في القيود لاحقاً
        productAccountsMap.set(product.id, {
          inv: invAcc,
          sales: salesAcc,
          cogs: cogsAcc,
        });

        const productUnit = await this.productRepository.getUnitById(
          invoiceItem.productId,
          invoiceItem.productUnitId,
        );

        if (!productUnit) {
          throw new Error(
            `Product unit not found: ${invoiceItem.productUnitId}`,
          );
        }

        if (
          !Number.isInteger(productUnit.conversionFactor) ||
          productUnit.conversionFactor <= 0
        ) {
          throw new Error(
            `Invalid conversion factor for product: ${product.name}`,
          );
        }

        const baseQuantity =
          invoiceItem.quantity * productUnit.conversionFactor;

        if (!Number.isSafeInteger(baseQuantity) || baseQuantity <= 0) {
          throw new Error(`Invalid base quantity for product: ${product.name}`);
        }

        const availableBatches =
          await this.inventoryRepository.getAvailableBatches(
            invoiceItem.productId,
          );

        const fifoAllocations = calculateFIFOAllocation(
          invoiceItem.productId,
          baseQuantity,
          availableBatches,
        );

        const itemCost = fifoAllocations.reduce(
          (sum, allocation) =>
            sum + allocation.quantityConsumed * allocation.unitCost,
          0,
        );

        if (!Number.isSafeInteger(itemCost) || itemCost < 0) {
          throw new Error(
            `Invalid calculated cost for product: ${product.name}`,
          );
        }

        totalCost += itemCost;

        postedItems.push({
          id: invoiceItem.id,
          baseQuantity,
          costAtSale: itemCost,
          batchConsumptions: fifoAllocations.map((allocation) => ({
            batchId: allocation.batchId,
            quantity: allocation.quantityConsumed,
            unitCost: allocation.unitCost,
          })),
        });
      }

      if (!Number.isSafeInteger(totalCost)) {
        throw new Error("Total cost of goods sold exceeds safe integer range.");
      }

      const invoiceNumber = await this.documentNumberGenerator.generate(
        DOCUMENT_PREFIXES.SALES_INVOICE,
        invoice.invoiceDate,
      );

      const postInput: PostSalesInvoiceInput = {
        id: invoice.id,
        invoiceNumber,
        items: postedItems,
      };
      /*
       * Consume inventory before posting the invoice.
       * Everything is protected by the same UnitOfWork.
       */
      for (const postedItem of postedItems) {
        await this.inventoryRepository.consumeBatches(
          postedItem.batchConsumptions.map((allocation) => ({
            batchId: allocation.batchId,
            quantity: allocation.quantity,
          })),
        );
      }

      /*
       * Create stock movements.
       * One movement is created for each consumed batch.
       */
      const stockMovements: any[] = [];

      for (const invoiceItem of invoice.items) {
        const postedItem = postedItems.find(
          (item) => item.id === invoiceItem.id,
        );

        if (!postedItem) {
          throw new Error(`Posted item not found: ${invoiceItem.id}`);
        }

        for (const allocation of postedItem.batchConsumptions) {
          stockMovements.push({
            productId: invoiceItem.productId,

            productUnitId: invoiceItem.productUnitId,

            batchId: allocation.batchId,

            quantity: allocation.quantity,

            movementType: STOCK_MOVEMENT_TYPES.SALE_OUT,

            referenceType: REFERENCE_TYPES.SALES_INVOICE,

            referenceId: invoice.id,

            unitCost: allocation.unitCost,

            movementDate: invoice.invoiceDate,
          });
        }
      }

      if (stockMovements.length > 0) {
        await this.inventoryRepository.createMovements(stockMovements);
      }

      const journalLines: any[] = [];

      /*
       * Revenue side.
       */
      if (invoice.paymentType === PAYMENT_TYPES.CASH) {
        if (!payment.paymentAccountId) {
          throw new Error("Payment account is required for cash sales.");
        }

        journalLines.push({
          accountId: payment.paymentAccountId,
          debit: invoice.total,
          credit: 0,
        });
      }

      if (invoice.paymentType === PAYMENT_TYPES.CREDIT) {
        if (!customer) {
          throw new Error("Customer is required for credit sales.");
        }

        journalLines.push({
          accountId: settings.customersAccountId,
          debit: invoice.total,
          credit: 0,
        });
      }

      if (invoice.paymentType === PAYMENT_TYPES.PARTIAL) {
        if (!customer) {
          throw new Error("Customer is required for partial sales.");
        }

        if (!payment.paymentAccountId) {
          throw new Error("Payment account is required for partial sales.");
        }

        journalLines.push({
          accountId: payment.paymentAccountId,
          debit: payment.paidAmount,
          credit: 0,
        });

        journalLines.push({
          accountId: settings.customersAccountId,
          debit: invoice.total - payment.paidAmount,
          credit: 0,
        });
      }

      /*
       * Sales revenue.
       */
      const uniqueProductIds = new Set(
        invoice.items.map((item) => item.productId),
      );

      for (const productId of uniqueProductIds) {
        const product = await this.productRepository.getById(productId);

        if (!product) {
          throw new Error(`Product not found: ${productId}`);
        }

        const productTotal = invoice.items
          .filter((item) => item.productId === productId)
          .reduce((sum, item) => sum + item.total, 0);

        const accs = productAccountsMap.get(productId);
        if (accs) {
          journalLines.push({
            accountId: accs.sales,
            debit: 0,
            credit: productTotal,
          });
        }
      }

      /*
       * COGS and inventory.
       */
      const cogsByAccount = new Map<string, number>();

      const inventoryByAccount = new Map<string, number>();

      for (const invoiceItem of invoice.items) {
        const product = await this.productRepository.getById(
          invoiceItem.productId,
        );

        if (!product) {
          throw new Error(`Product not found: ${invoiceItem.productId}`);
        }

        const postedItem = postedItems.find(
          (item) => item.id === invoiceItem.id,
        );

        if (!postedItem) {
          throw new Error(`Posted item not found: ${invoiceItem.id}`);
        }

        const accs = productAccountsMap.get(invoiceItem.productId);
        if (accs) {
          cogsByAccount.set(
            accs.cogs,
            (cogsByAccount.get(accs.cogs) ?? 0) + postedItem.costAtSale,
          );

          inventoryByAccount.set(
            accs.inv,
            (inventoryByAccount.get(accs.inv) ?? 0) + postedItem.costAtSale,
          );
        }
      }

      for (const [accountId, amount] of cogsByAccount) {
        journalLines.push({
          accountId,
          debit: amount,
          credit: 0,
        });
      }

      for (const [accountId, amount] of inventoryByAccount) {
        journalLines.push({
          accountId,
          debit: 0,
          credit: amount,
        });
      }

            // ✅ إيراد أجور الخدمة (إلى حساب الخدمات المستقل)
      if (invoice.serviceFee && invoice.serviceFee > 0) {
        const serviceAcc = settings.serviceRevenueAccountId || settings.salesDefaultAccountId;
        if (!serviceAcc) {
          throw new Error("لم يتم ضبط حساب إيرادات الخدمات في الإعدادات المحاسبية.");
        }
        journalLines.push({
          accountId: serviceAcc,
          debit: 0,
          credit: invoice.serviceFee,
        });
      }

      // ✅ الخصم (مدين - يقلل الإيراد)
      if (invoice.discountTotal && invoice.discountTotal > 0) {
        const discountAcc = settings.salesDefaultAccountId;
        if (!discountAcc) {
          throw new Error("لم يتم ضبط حساب المبيعات الافتراضي لخصم الفاتورة.");
        }
        journalLines.push({
          accountId: discountAcc,
          debit: invoice.discountTotal,
          credit: 0,
        });
      }

      this.validateJournalBalance(journalLines);

      const journalInput: CreateJournalEntryInput = {
        entryDate: invoice.invoiceDate,

        referenceType: REFERENCE_TYPES.SALES_INVOICE,

        referenceId: invoice.id,

        description: `ØªØ±Ø­ÙŠÙ„ ÙØ§ØªÙˆØ±Ø© Ù…Ø¨ÙŠØ¹Ø§Øª ${invoiceNumber}`,

        createdBy: invoice.createdBy,

        idempotencyKey: invoice.idempotencyKey
          ? `sales-journal:${invoice.idempotencyKey}`
          : undefined,

        lines: journalLines,
      };

      const journal = await this.journalEntryRepository.createDraft(
        journalInput,
      );

      await this.journalEntryRepository.post(journal.id);

      const postedInvoice = await this.salesInvoiceRepository.persistPosted(
        postInput,
      );

      /*
       * paid_amount is a cache.
       * For cash/partial sales, the immediate
       * payment is stored here.
       */
      // âœ… setPaidAmount (ØªØ¹ÙŠÙŠÙ†) Ø¨Ø¯Ù„Ø§Ù‹ Ù…Ù† increasePaidAmount (Ø¥Ø¶Ø§ÙØ©)
      // Ù„Ø£Ù† paidAmount Ù…Ø­ÙÙˆØ¸ ÙÙŠ Ø§Ù„Ù…Ø³ÙˆØ¯Ø© Ø¨Ø§Ù„ÙØ¹Ù„
      await this.salesInvoiceRepository.setPaidAmount(
        postedInvoice.id,
        payment.paidAmount,
      );

      return (await this.salesInvoiceRepository.getById(postedInvoice.id))!;
    });
  }

  async cancel(id: string, cancelledAt: string): Promise<SalesInvoiceData> {
    this.validateId(id);
    this.validateDate(cancelledAt);
    return this.unitOfWork.execute(async () => {
      const invoice = await this.salesInvoiceRepository.getById(id);
      if (!invoice) {
        throw new Error(`Sales invoice not found: ${id}`);
      }
      if (invoice.isCancelled) {
        return invoice;
      }
      if (invoice.status !== DOCUMENT_STATUSES.POSTED) {
        throw new Error("Only posted sales invoices can be cancelled.");
      }
      const allocationsCollection = database.get<ReceiptAllocation>(
        "receipt_allocations",
      );
      const allocations = await allocationsCollection
        .query(Q.where("sales_invoice_id", id))
        .fetch();
      if (allocations.length > 0) {
        throw new Error(
          "Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ù„ØºØ§Ø¡ ÙØ§ØªÙˆØ±Ø© Ù…Ø¨ÙŠØ¹Ø§Øª Ø¹Ù„ÙŠÙ‡Ø§ Ø³Ù†Ø¯Ø§Øª Ù‚Ø¨Ø¶ Ù…Ø³Ø¬Ù„Ø©. ÙŠØ¬Ø¨ Ø¥Ù„ØºØ§Ø¡ Ø³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶ Ø£ÙˆÙ„Ø§Ù‹.",
        );
      }
      for (const item of invoice.items) {
        if (item.batchConsumptions && item.batchConsumptions.length > 0) {
          await this.inventoryRepository.restoreBatches(
            item.batchConsumptions.map((c) => ({
              batchId: c.batchId,
              quantity: c.quantity,
            })),
          );
        }
      }
      const stockMovements: any[] = [];
      for (const item of invoice.items) {
        for (const consumption of item.batchConsumptions ?? []) {
          stockMovements.push({
            productId: item.productId,
            productUnitId: item.productUnitId,
            batchId: consumption.batchId,
            quantity: consumption.quantity,
            movementType: STOCK_MOVEMENT_TYPES.SALE_RETURN,
            referenceType: REFERENCE_TYPES.SALES_INVOICE,
            referenceId: invoice.id,
            unitCost: consumption.unitCost,
            movementDate: cancelledAt,
          });
        }
      }
      if (stockMovements.length > 0) {
        await this.inventoryRepository.createMovements(stockMovements);
      }
      const journal = await this.journalEntryRepository.getPostedByReference(
        REFERENCE_TYPES.SALES_INVOICE,
        invoice.id,
      );
      if (journal) {
        await this.journalEntryRepository.reverse(
          journal.id,
          cancelledAt,
          `Ø¹ÙƒØ³ ÙØ§ØªÙˆØ±Ø© Ù…Ø¨ÙŠØ¹Ø§Øª ${
            invoice.invoiceNumber ?? invoice.id
          }`,
        );
      }
      if (invoice.paidAmount > 0) {
        await this.salesInvoiceRepository.decreasePaidAmount(
          invoice.id,
          invoice.paidAmount,
        );
      }
      return this.salesInvoiceRepository.markCancelled(invoice.id, cancelledAt);
    });
  }

  private validateId(id: string, name = "ID"): void {
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new Error(`${name} is required.`);
    }
  }

  private validateDate(date: string): void {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(
        `Invalid date format. Expected YYYY-MM-DD, received: ${date}`,
      );
    }
  }

  private validateCreateInput(input: CreateSalesInvoiceInput): void {
    if (!input.invoiceDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.invoiceDate)) {
      throw new Error("Invalid invoice date. Expected YYYY-MM-DD.");
    }

    if (!input.createdBy?.trim()) {
      throw new Error("Created by is required.");
    }

    if (!Object.values(PAYMENT_TYPES).includes(input.paymentType)) {
      throw new Error(`Invalid payment type: ${input.paymentType}`);
    }

    if (input.items.length === 0) {
      throw new Error("Sales invoice must contain at least one item.");
    }

    const productUnitKeys = new Set<string>();

    for (const item of input.items) {
      if (!item.productId?.trim()) {
        throw new Error("Product is required.");
      }

      if (!item.productUnitId?.trim()) {
        throw new Error("Product unit is required.");
      }

      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new Error("Item quantity must be greater than zero.");
      }

      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
        throw new Error("Item unit price must be non-negative.");
      }

      const key = `${item.productId}:${item.productUnitId}`;

      if (productUnitKeys.has(key)) {
        throw new Error(
          "The same product unit cannot appear more than once in the invoice.",
        );
      }

      productUnitKeys.add(key);
    }
  }

  private async validateCustomer(invoice: SalesInvoiceData) {
    if (invoice.paymentType === PAYMENT_TYPES.CASH) {
      if (!invoice.customerId) {
        return null;
      }
    }

    if (!invoice.customerId) {
      throw new Error("Customer is required for credit and partial sales.");
    }

    const customer = await this.customerRepository.getById(invoice.customerId);

    if (!customer) {
      throw new Error(`Customer not found: ${invoice.customerId}`);
    }

    if (!customer.isActive) {
      throw new Error("Inactive customers cannot be used for new sales.");
    }

    return customer;
  }

  private validatePayment(
    invoice: SalesInvoiceData,
    command: PostSalesInvoiceCommand,
  ): {
    paidAmount: number;
    paymentAccountId?: string;
  } {
    const paidAmount = Math.round(command.paidAmount);
    const invoiceTotal = Math.round(invoice.total);

    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      throw new Error("Paid amount must be a non-negative finite number.");
    }

    if (!Number.isSafeInteger(paidAmount)) {
      throw new Error("Paid amount must be an integer.");
    }

    if (paidAmount > invoiceTotal) {
      throw new Error("Paid amount cannot exceed invoice total.");
    }

    if (invoice.paymentType === PAYMENT_TYPES.CASH) {
      if (paidAmount !== invoice.total) {
        throw new Error("Cash sales must be fully paid.");
      }

      if (!command.paymentAccountId) {
        throw new Error("Payment account is required for cash sales.");
      }
    }

    if (invoice.paymentType === PAYMENT_TYPES.CREDIT) {
      if (paidAmount !== 0) {
        throw new Error("Credit sales must have zero immediate payment.");
      }
    }

    if (invoice.paymentType === PAYMENT_TYPES.PARTIAL) {
      if (paidAmount <= 0 || paidAmount >= invoice.total) {
        throw new Error(
          "Partial sales require a payment greater than zero and less than the invoice total.",
        );
      }

      if (!command.paymentAccountId) {
        throw new Error("Payment account is required for partial sales.");
      }
    }

    return {
      paidAmount,
      paymentAccountId: command.paymentAccountId,
    };
  }

  private async validateOpenPeriod(date: string): Promise<void> {
    const period = await this.accountingPeriodRepository.getOpenPeriod();

    if (!period) {
      throw new Error("No open accounting period is available.");
    }

    if (date < period.startDate || date > period.endDate) {
      throw new Error(
        `Invoice date ${date} is outside the open accounting period.`,
      );
    }
  }

  // ========== Reactive reads (Ù„Ù„ÙˆØ§Ø¬Ù‡Ø©) ==========

  /**
   * âš ï¸ UI-optimized: ØªØ±Ø¬Ø¹ WatermelonDB Model Ù…Ø¨Ø§Ø´Ø±Ø©.
   * Ù„Ø§ ØªØ³ØªØ®Ø¯Ù… _raw Ø£Ùˆ Ø£ÙŠ relation ÙÙŠ Ø§Ù„Ø´Ø§Ø´Ø©.
   */
  observeAll(): Observable<SalesInvoiceModel[]> {
    return database
      .get<SalesInvoiceModel>("sales_invoices")
      .query(Q.sortBy("created_at", Q.desc))
      .observe();
  }

  observeItems(invoiceId: string): Observable<SalesInvoiceItemModel[]> {
    return database
      .get<SalesInvoiceItemModel>("sales_invoice_items")
      .query(
        Q.where("sales_invoice_id", invoiceId),
        Q.sortBy("created_at", Q.asc),
      )
      .observe();
  }

  searchByInvoiceNumber(term: string): Observable<SalesInvoiceModel[]> {
    return database
      .get<SalesInvoiceModel>("sales_invoices")
      .query(
        Q.where("invoice_number", Q.like(`%${Q.sanitizeLikeString(term)}%`)),
        Q.sortBy("invoice_date", Q.desc),
      )
      .observe();
  }

  private validateJournalBalance(
    lines: {
      accountId: string;
      debit: number;
      credit: number;
    }[],
  ): void {
    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);

    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

    if (totalDebit !== totalCredit) {
      throw new Error(
        `Journal entry is unbalanced. Debit=${totalDebit}, Credit=${totalCredit}`,
      );
    }

    if (totalDebit <= 0) {
      throw new Error("Journal entry total must be greater than zero.");
    }
  }
}


