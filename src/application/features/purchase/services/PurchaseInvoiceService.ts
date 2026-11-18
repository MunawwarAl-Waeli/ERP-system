import { database } from "src/database";
import ProductBatch from "src/database/models/ProductBatch";
import PaymentVoucher from "src/database/models/PaymentVoucher";
import { Q } from "@nozbe/watermelondb";
import {
  DOCUMENT_PREFIXES,
  PAYMENT_TYPES,
  REFERENCE_TYPES,
  STOCK_MOVEMENT_TYPES,
  PaymentType,
} from "@core/constants";

import { validateJournalEntry } from "@core/domain/accounting/journalValidation";
import {
  convertToBaseUnit,
  convertUnitCostToBaseUnit,
} from "@core/domain/inventory/unitConversion";

import {
  CreatePurchaseInvoiceInput,
  PurchaseInvoiceData,
} from "@core/types/purchases/purchaseInvoice";

import { AccountingSettingRepository } from "@application/features/accounting/repositories/AccountingSettingRepository";
import { JournalEntryRepository } from "@application/features/accounting/repositories/JournalEntryRepository";
import { InventoryRepository } from "@application/features/inventory/repositories/inventoryRepository";
import { ProductRepository } from "@application/features/inventory/repositories/productRepository";
import { PurchaseInvoiceRepository } from "@application/features/purchase/repositories/PurchaseInvoiceRepository";
import { PaymentVoucherRepository } from "@application/features/purchase/repositories/PaymentVoucherRepository";

import { UnitOfWork } from "@application/transactions/UnitOfWork";
import { DocumentNumberGenerator } from "@application/numbering/DocumentNumberGenerator";
import {
  CreateProductBatchInput,
  StockMovementInput,
} from "@core/types/inventory/inventory";

export interface PurchaseInvoiceService {
  createDraft(input: CreatePurchaseInvoiceInput): Promise<PurchaseInvoiceData>;
  updateDraft(
    id: string,
    input: CreatePurchaseInvoiceInput,
  ): Promise<PurchaseInvoiceData>;
  post(invoiceId: string, paymentAmount?: number): Promise<PurchaseInvoiceData>;
  cancel(invoiceId: string, cancelledAt: string): Promise<PurchaseInvoiceData>;
  deleteDraft(invoiceId: string): Promise<void>;
}

export class PurchaseInvoiceServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseInvoiceServiceError";
  }
}

export interface PurchaseInvoiceServiceDependencies {
  unitOfWork: UnitOfWork;
  purchaseInvoiceRepository: PurchaseInvoiceRepository;
  productRepository: ProductRepository;
  inventoryRepository: InventoryRepository;
  paymentVoucherRepository: PaymentVoucherRepository;
  journalEntryRepository: JournalEntryRepository;
  accountingSettingRepository: AccountingSettingRepository;
  documentNumberGenerator: DocumentNumberGenerator;
}

export class PurchaseInvoiceServiceImpl implements PurchaseInvoiceService {
  constructor(private readonly deps: PurchaseInvoiceServiceDependencies) {}

  async createDraft(
    input: CreatePurchaseInvoiceInput,
  ): Promise<PurchaseInvoiceData> {
    this.validateCreateInput(input);

    return this.deps.unitOfWork.execute(async () => {
      if (input.idempotencyKey) {
        const existing =
          await this.deps.purchaseInvoiceRepository.getByIdempotencyKey(
            input.idempotencyKey,
          );
        if (existing) {
          return existing;
        }
      }
      return this.deps.purchaseInvoiceRepository.createDraft(input);
    });
  }

  async updateDraft(
    id: string,
    input: CreatePurchaseInvoiceInput,
  ): Promise<PurchaseInvoiceData> {
    this.validateCreateInput(input);

    return this.deps.unitOfWork.execute(async () => {
      const existing = await this.deps.purchaseInvoiceRepository.getById(id);

      if (!existing) {
        throw new PurchaseInvoiceServiceError("Purchase invoice not found.");
      }
      if (existing.isCancelled) {
        throw new PurchaseInvoiceServiceError(
          "Cancelled purchase invoices cannot be updated.",
        );
      }
      if (existing.status !== "draft") {
        throw new PurchaseInvoiceServiceError(
          "Only draft purchase invoices can be updated.",
        );
      }

      return this.deps.purchaseInvoiceRepository.updateDraft(id, input);
    });
  }

  async post(
    invoiceId: string,
    paymentAmount?: number,
  ): Promise<PurchaseInvoiceData> {
    return this.deps.unitOfWork.execute(async () => {
      /*
       * ---------------------------------------------------------
       * 0. Idempotency guard — prevent double-posting
       * ---------------------------------------------------------
       *
       * If a posted journal already exists for this invoice,
       * we MUST NOT touch inventory or accounting again.
       * This covers:
       *   - user double-tap on "post"
       *   - partial failure & retry
       *   - concurrent post attempts
       */
      const existingPurchaseJournal =
        await this.deps.journalEntryRepository.getPostedByReference(
          REFERENCE_TYPES.PURCHASE_INVOICE,
          invoiceId,
        );

      if (existingPurchaseJournal) {
        const current = await this.deps.purchaseInvoiceRepository.getById(
          invoiceId,
        );
        if (current?.status === "posted") {
          // Safe no-op — already posted
          return current;
        }
        throw new PurchaseInvoiceServiceError(
          "Purchase invoice has a posted journal but status is not 'posted'. " +
            "Data may be inconsistent; please contact support.",
        );
      }

      /*
       * ---------------------------------------------------------
       * 1. Load invoice
       * ---------------------------------------------------------
       */
      const invoice = await this.deps.purchaseInvoiceRepository.getById(
        invoiceId,
      );

      if (!invoice) {
        throw new PurchaseInvoiceServiceError("Purchase invoice not found.");
      }
      if (invoice.isCancelled) {
        throw new PurchaseInvoiceServiceError(
          "Cancelled purchase invoices cannot be posted.",
        );
      }
      if (invoice.status !== "draft") {
        throw new PurchaseInvoiceServiceError(
          "Only draft purchase invoices can be posted.",
        );
      }
      if (invoice.paymentType !== PAYMENT_TYPES.CASH && !invoice.supplierId) {
        throw new PurchaseInvoiceServiceError(
          "Supplier is required for credit or partial purchase invoices.",
        );
      }

      /*
       * ---------------------------------------------------------
       * 2. Resolve payment
       * ---------------------------------------------------------
       */
      const resolvedPaymentAmount = this.resolvePaymentAmount(
        invoice.paymentType,
        invoice.total,
        paymentAmount,
      );

      /*
       * ---------------------------------------------------------
       * 3. Accounting settings
       * ---------------------------------------------------------
       */
      const settings = await this.deps.accountingSettingRepository.get();

      if (!settings) {
        throw new PurchaseInvoiceServiceError(
          "Accounting settings are not configured.",
        );
      }
      if (!settings.suppliersAccountId) {
        throw new PurchaseInvoiceServiceError(
          "Suppliers account is not configured.",
        );
      }
      if (resolvedPaymentAmount > 0 && !settings.cashDefaultAccountId) {
        throw new PurchaseInvoiceServiceError(
          "Default cash account is not configured.",
        );
      }

      /*
       * ---------------------------------------------------------
       * 4. Generate / resolve invoice number
       * ---------------------------------------------------------
       */
      const invoiceNumber =
        invoice.invoiceNumber ??
        (await this.deps.documentNumberGenerator.generate(
          DOCUMENT_PREFIXES.PURCHASE_INVOICE,
          invoice.invoiceDate,
        ));

      /*
       * ---------------------------------------------------------
       * 5. Prepare inventory + accounting data
       * ---------------------------------------------------------
       */
      const batchInputs: Array<CreateProductBatchInput> = [];
      const stockMovements: Array<StockMovementInput> = [];
      const journalLines: Array<{
        accountId: string;
        debit: number;
        credit: number;
      }> = [];

      for (const item of invoice.items) {
        const product = await this.deps.productRepository.getById(
          item.productId,
        );

        if (!product) {
          throw new PurchaseInvoiceServiceError(
            `Product not found: ${item.productId}`,
          );
        }
        if (!product.isActive) {
          throw new PurchaseInvoiceServiceError(
            `Product is inactive: ${product.name}`,
          );
        }

        const productUnit = await this.deps.productRepository.getUnitById(
          item.productId,
          item.productUnitId,
        );

        if (!productUnit) {
          throw new PurchaseInvoiceServiceError(
            `Product unit not found: ${item.productUnitId}`,
          );
        }

        const baseQuantity = convertToBaseUnit({
          quantity: item.quantity,
          conversionFactor: productUnit.conversionFactor,
        });

        if (!Number.isInteger(baseQuantity)) {
          throw new PurchaseInvoiceServiceError(
            `Quantity for product "${product.name}" results in a fractional base quantity.`,
          );
        }

        const baseUnitCost = convertUnitCostToBaseUnit({
          unitCost: item.unitCost,
          conversionFactor: productUnit.conversionFactor,
        });

        batchInputs.push({
          productId: item.productId,
          purchaseItemId: item.id,
          quantityReceived: baseQuantity,
          quantityRemaining: baseQuantity,
          unitCost: baseUnitCost,
          receivedDate: invoice.invoiceDate,
        });

        stockMovements.push({
          productId: item.productId,
          productUnitId: item.productUnitId,
          quantity: baseQuantity,
          movementType: STOCK_MOVEMENT_TYPES.PURCHASE_IN,
          referenceType: REFERENCE_TYPES.PURCHASE_INVOICE,
          referenceId: invoice.id,
          unitCost: baseUnitCost,
          movementDate: invoice.invoiceDate,
        });

        journalLines.push({
          accountId: product.inventoryAccountId,
          debit: item.total,
          credit: 0,
        });
      }

      /*
       * ---------------------------------------------------------
       * 6. Supplier payable
       * ---------------------------------------------------------
       */
      journalLines.push({
        accountId: settings.suppliersAccountId,
        debit: 0,
        credit: invoice.total,
      });

      /*
       * ---------------------------------------------------------
       * 7. Validate purchase journal
       * ---------------------------------------------------------
       */
      validateJournalEntry(journalLines);

      /*
       * ---------------------------------------------------------
       * 8-9. Create product batches + stock movements
       * ---------------------------------------------------------
       */
      for (const batchInput of batchInputs) {
        await this.deps.inventoryRepository.createBatch(batchInput);
      }
      await this.deps.inventoryRepository.createMovements(stockMovements);

      /*
       * ---------------------------------------------------------
       * 10. Purchase journal
       * ---------------------------------------------------------
       */
      const purchaseJournal =
        await this.deps.journalEntryRepository.createDraft({
          entryDate: invoice.invoiceDate,
          referenceType: REFERENCE_TYPES.PURCHASE_INVOICE,
          referenceId: invoice.id,
          description: `Purchase invoice ${invoiceNumber}`,
          createdBy: invoice.createdBy,
          idempotencyKey: this.buildPurchaseJournalKey(invoice),
          lines: journalLines,
        });

      await this.deps.journalEntryRepository.post(purchaseJournal.id);

      /*
       * ---------------------------------------------------------
       * 11. Automatic payment
       * ---------------------------------------------------------
       */
      if (resolvedPaymentAmount > 0) {
        await this.createAutoPayment({
          invoice,
          invoiceNumber,
          paymentAmount: resolvedPaymentAmount,
          supplierAccountId: settings.suppliersAccountId,
          cashAccountId: settings.cashDefaultAccountId!,
        });
      }

      /*
       * ---------------------------------------------------------
       * 12. Mark invoice as posted
       * ---------------------------------------------------------
       */
      return this.deps.purchaseInvoiceRepository.markPosted(
        invoice.id,
        invoiceNumber,
      );
    });
  }

  // ============================================================
  // Auto-payment
  // ============================================================

  private async createAutoPayment(input: {
    invoice: PurchaseInvoiceData;
    invoiceNumber: string;
    paymentAmount: number;
    supplierAccountId: string;
    cashAccountId: string;
  }): Promise<void> {
    const {
      invoice,
      invoiceNumber,
      paymentAmount,
      supplierAccountId,
      cashAccountId,
    } = input;

    const voucherNumber = await this.deps.documentNumberGenerator.generate(
      DOCUMENT_PREFIXES.PAYMENT_VOUCHER,
      invoice.invoiceDate,
    );

    /*
     * ---------------------------------------------------------
     * 1. Create payment voucher
     *
     * FIX (N12): use the unified key builder so that cancel()
     * can reliably find this voucher later.
     * ---------------------------------------------------------
     */
    const paymentVoucher = await this.deps.paymentVoucherRepository.createDraft(
      {
        voucherNumber,
        voucherDate: invoice.invoiceDate,
        paymentAccountId: cashAccountId,
        supplierId: invoice.supplierId,
        amount: paymentAmount,
        description: `Auto-payment for purchase invoice ${invoiceNumber}`,
        createdBy: invoice.createdBy,
        idempotencyKey: this.buildAutoPaymentKey(invoice),
      },
    );

    /*
     * ---------------------------------------------------------
     * 2. Allocate payment
     * ---------------------------------------------------------
     */
    await this.deps.paymentVoucherRepository.persistPosted({
      id: paymentVoucher.id,
      allocations: [
        {
          purchaseInvoiceId: invoice.id,
          amount: paymentAmount,
        },
      ],
    });

    /*
     * ---------------------------------------------------------
     * 3. Update paid_amount cache
     * ---------------------------------------------------------
     */
    await this.deps.purchaseInvoiceRepository.setPaidAmount(
      invoice.id,
      paymentAmount,
    );

    /*
     * ---------------------------------------------------------
     * 4. Payment journal: Supplier Dr / Cash Cr
     * ---------------------------------------------------------
     */
    const paymentJournalLines = [
      {
        accountId: supplierAccountId,
        debit: paymentAmount,
        credit: 0,
      },
      {
        accountId: cashAccountId,
        debit: 0,
        credit: paymentAmount,
      },
    ];

    validateJournalEntry(paymentJournalLines);

    const paymentJournal = await this.deps.journalEntryRepository.createDraft({
      entryDate: invoice.invoiceDate,
      referenceType: REFERENCE_TYPES.PAYMENT_VOUCHER,
      referenceId: paymentVoucher.id,
      description: `Payment for purchase invoice ${invoiceNumber}`,
      createdBy: invoice.createdBy,
      idempotencyKey: this.buildAutoPaymentJournalKey(invoice),
      lines: paymentJournalLines,
    });

    await this.deps.journalEntryRepository.post(paymentJournal.id);
  }

  // ============================================================
  // Cancel
  // ============================================================

  async cancel(
    invoiceId: string,
    cancelledAt: string,
  ): Promise<PurchaseInvoiceData> {
    const normalizedDate = this.normalizeDate(cancelledAt);

    return this.deps.unitOfWork.execute(async () => {
      const invoice = await this.deps.purchaseInvoiceRepository.getById(
        invoiceId,
      );
      if (!invoice) {
        throw new PurchaseInvoiceServiceError("Purchase invoice not found.");
      }
      if (invoice.isCancelled) {
        return invoice;
      }
      if (invoice.status !== "posted") {
        throw new PurchaseInvoiceServiceError(
          "Only posted purchase invoices can be cancelled.",
        );
      }

      /*
       * ---------------------------------------------------------
       * 1. Load batches via indexed query
       *
       * FIX (A1): replaces `query().fetch().filter()` which
       * pulled the entire table into memory.
       * ---------------------------------------------------------
       */
      const itemIds = invoice.items.map((i) => i.id);
      const batches =
        await this.deps.purchaseInvoiceRepository.getBatchesByPurchaseItemIds(
          itemIds,
        );

      /*
       * ---------------------------------------------------------
       * 2. Ensure no batch has been consumed
       *
       * FIX: use tolerance comparison for float safety.
       * ---------------------------------------------------------
       */
      for (const batch of batches) {
        if (
          Math.abs(batch.quantityRemaining - batch.quantityReceived) > 0.0001
        ) {
          throw new PurchaseInvoiceServiceError(
            "لا يمكن إلغاء فاتورة الشراء لأن بعض كمياتها تم بيعها بالفعل.",
          );
        }
      }

      /*
       * ---------------------------------------------------------
       * 3. Zero out remaining quantities
       * ---------------------------------------------------------
       */
      if (batches.length > 0) {
        await database.batch(
          ...batches.map((b) =>
            b.prepareUpdate((record: { quantityRemaining: number }) => {
              record.quantityRemaining = 0;
            }),
          ),
        );
      }

      /*
       * ---------------------------------------------------------
       * 4. Create reversal stock movements
       *
       * FIX (C6): link each batch back to its SPECIFIC item
       * via purchaseItemId (not via productId lookup which
       * breaks when the same product appears twice).
       * ---------------------------------------------------------
       */
      const itemByPurchaseItemId = new Map(invoice.items.map((i) => [i.id, i]));

      const movements = batches.map((b) => {
        const purchaseItemId = b.purchaseItemId;
        if (!purchaseItemId) {
          throw new PurchaseInvoiceServiceError(
            `Batch ${b.id} is missing purchase_item_id.`,
          );
        }
        const item = itemByPurchaseItemId.get(purchaseItemId);
        if (!item) {
          throw new PurchaseInvoiceServiceError(
            `Batch ${b.id} references unknown purchase item ${purchaseItemId}.`,
          );
        }
        return {
          productId: b.product.id,
          productUnitId: item.productUnitId,
          quantity: b.quantityReceived,
          // TODO(Sprint 3): introduce PURCHASE_RETURN movement type
          // and stop overloading ADJUSTMENT_OUT.
          movementType: STOCK_MOVEMENT_TYPES.ADJUSTMENT_OUT,
          referenceType: REFERENCE_TYPES.PURCHASE_INVOICE,
          referenceId: invoice.id,
          unitCost: b.unitCost,
          movementDate: normalizedDate,
        };
      });

      if (movements.length > 0) {
        await this.deps.inventoryRepository.createMovements(movements as any);
      }

      /*
       * ---------------------------------------------------------
       * 5. Find and cancel auto-created payment vouchers
       *
       * FIX (N12): query BOTH the new unified key and the
       * legacy "purchase:..." key, to remain backward-compatible
       * with vouchers created before this fix.
       * ---------------------------------------------------------
       */
      const autoPaymentKeys = [
        this.buildAutoPaymentKey(invoice),
        `purchase:${invoice.id}:auto-payment`, // legacy fallback
      ];

      const paymentCollection =
        database.get<PaymentVoucher>("payment_vouchers");
      const autoPvs = await paymentCollection
        .query(Q.where("idempotency_key", Q.oneOf(autoPaymentKeys)))
        .fetch();

      for (const autoPv of autoPvs) {
        if (autoPv.isCancelled) continue;

        await this.deps.paymentVoucherRepository.markCancelled(
          autoPv.id,
          normalizedDate,
        );

        const autoPvJournal =
          await this.deps.journalEntryRepository.getPostedByReference(
            REFERENCE_TYPES.PAYMENT_VOUCHER,
            autoPv.id,
          );
        if (autoPvJournal) {
          await this.deps.journalEntryRepository.reverse(
            autoPvJournal.id,
            normalizedDate,
            `عكس سداد فاتورة شراء ${invoice.invoiceNumber ?? invoice.id}`,
          );
        }
      }

      /*
       * ---------------------------------------------------------
       * 6. Reset paid_amount cache
       *
       * FIX (N13): the invoice is being fully cancelled, so
       * its paid_amount must return to 0 to stay consistent
       * with the reversed GL. Otherwise reports that read
       * paid_amount directly will show stale payments.
       * ---------------------------------------------------------
       */
      if (invoice.paidAmount > 0) {
        await this.deps.purchaseInvoiceRepository.setPaidAmount(invoice.id, 0);
      }

      /*
       * ---------------------------------------------------------
       * 7. Reverse purchase journal
       * ---------------------------------------------------------
       */
      const purchaseJournal =
        await this.deps.journalEntryRepository.getPostedByReference(
          REFERENCE_TYPES.PURCHASE_INVOICE,
          invoice.id,
        );
      if (purchaseJournal) {
        await this.deps.journalEntryRepository.reverse(
          purchaseJournal.id,
          normalizedDate,
          `عكس فاتورة شراء ${invoice.invoiceNumber ?? invoice.id}`,
        );
      }

      /*
       * ---------------------------------------------------------
       * 8. Mark invoice as cancelled
       * ---------------------------------------------------------
       */
      return this.deps.purchaseInvoiceRepository.markCancelled(
        invoice.id,
        normalizedDate,
      );
    });
  }

  // ============================================================
  // Helpers — idempotency key builders (single source of truth)
  // ============================================================

  private buildAutoPaymentKey(invoice: PurchaseInvoiceData): string {
    return `${invoice.idempotencyKey ?? invoice.id}:auto-payment`;
  }

  private buildAutoPaymentJournalKey(invoice: PurchaseInvoiceData): string {
    return `${invoice.idempotencyKey ?? invoice.id}:auto-payment-journal`;
  }

  private buildPurchaseJournalKey(invoice: PurchaseInvoiceData): string {
    return `${invoice.idempotencyKey ?? invoice.id}:purchase-journal`;
  }

  // ============================================================
  // Payment resolution
  // ============================================================

  private resolvePaymentAmount(
    paymentType: PaymentType,
    total: number,
    requestedAmount?: number,
  ): number {
    if (!Number.isFinite(total) || total <= 0) {
      throw new PurchaseInvoiceServiceError(
        "Invoice total must be greater than zero.",
      );
    }

    if (
      requestedAmount !== undefined &&
      (!Number.isFinite(requestedAmount) || requestedAmount < 0)
    ) {
      throw new PurchaseInvoiceServiceError(
        "Payment amount must be a valid non-negative number.",
      );
    }

    switch (paymentType) {
      case PAYMENT_TYPES.CASH:
        if (requestedAmount !== undefined && requestedAmount !== total) {
          throw new PurchaseInvoiceServiceError(
            "Cash purchase payment must equal the invoice total.",
          );
        }
        return total;

      case PAYMENT_TYPES.CREDIT:
        if (requestedAmount !== undefined && requestedAmount !== 0) {
          throw new PurchaseInvoiceServiceError(
            "Credit purchase cannot have an immediate payment.",
          );
        }
        return 0;

      case PAYMENT_TYPES.PARTIAL:
        if (requestedAmount === undefined || requestedAmount <= 0) {
          throw new PurchaseInvoiceServiceError(
            "Partial purchase requires a payment amount.",
          );
        }
        if (requestedAmount >= total) {
          throw new PurchaseInvoiceServiceError(
            "Partial payment must be less than the invoice total.",
          );
        }
        return requestedAmount;

      default:
        throw new PurchaseInvoiceServiceError(
          `Unsupported payment type: ${paymentType}`,
        );
    }
  }

  // ============================================================
  // Validation
  // ============================================================

  private validateCreateInput(input: CreatePurchaseInvoiceInput): void {
    if (!input.invoiceDate) {
      throw new PurchaseInvoiceServiceError("Invoice date is required.");
    }
    if (!input.createdBy) {
      throw new PurchaseInvoiceServiceError("Created by is required.");
    }
    if (!input.items.length) {
      throw new PurchaseInvoiceServiceError(
        "Purchase invoice must contain at least one item.",
      );
    }

    for (const item of input.items) {
      if (!item.productId) {
        throw new PurchaseInvoiceServiceError(
          "Product is required for every item.",
        );
      }
      if (!item.productUnitId) {
        throw new PurchaseInvoiceServiceError(
          "Product unit is required for every item.",
        );
      }
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new PurchaseInvoiceServiceError(
          "Item quantity must be greater than zero.",
        );
      }
      if (!Number.isFinite(item.unitCost) || item.unitCost <= 0) {
        throw new PurchaseInvoiceServiceError(
          "Item unit cost must be greater than zero.",
        );
      }
      if (!Number.isFinite(item.total) || item.total <= 0) {
        throw new PurchaseInvoiceServiceError(
          "Item total must be greater than zero.",
        );
      }
    }
  }

  async deleteDraft(invoiceId: string): Promise<void> {
    return this.deps.unitOfWork.execute(async () => {
      const invoice = await this.deps.purchaseInvoiceRepository.getById(
        invoiceId,
      );
      if (!invoice) {
        throw new PurchaseInvoiceServiceError("Purchase invoice not found.");
      }
      if (invoice.status !== "draft") {
        throw new PurchaseInvoiceServiceError(
          "Only draft invoices can be deleted.",
        );
      }
      await this.deps.purchaseInvoiceRepository.deleteDraft(invoiceId);
    });
  }

  private normalizeDate(value: string): string {
    const trimmed = value?.trim();
    if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new PurchaseInvoiceServiceError(
        `Invalid date format: ${value}. Expected YYYY-MM-DD.`,
      );
    }
    return trimmed;
  }
}
