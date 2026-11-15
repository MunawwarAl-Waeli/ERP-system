import {
  DOCUMENT_PREFIXES,
  DOCUMENT_STATUSES,
  REFERENCE_TYPES,
} from "@core/constants";
import {
  CreatePaymentVoucherInput,
  PaymentAllocationInput,
  PaymentVoucherData,
  PostPaymentVoucherInput,
} from "@core/types/purchases/paymentVoucher";
import { CreateJournalEntryInput } from "@core/types/accounting/journal";
import { PaymentVoucherRepository } from "@application/features/purchase/repositories/PaymentVoucherRepository";
import { PurchaseInvoiceRepository } from "@application/features/purchase/repositories/PurchaseInvoiceRepository";
import { JournalEntryRepository } from "@application/features/accounting/repositories/JournalEntryRepository";
import { AccountingSettingRepository } from "@application/features/accounting/repositories/AccountingSettingRepository";
import { DocumentNumberGenerator } from "@application/numbering/DocumentNumberGenerator";
import { UnitOfWork } from "@application/transactions/UnitOfWork";
import {
  calculateOldestFirstAllocation,
  OutstandingDocument,
} from "@core/domain/payments/oldestFirstAllocation";

export interface PostPaymentVoucherCommand {
  paymentVoucherId: string;
  allocations: PaymentAllocationInput[];
}

export interface AutoAllocatePaymentInput {
  voucherNumber?: string;
  voucherDate: string;
  paymentAccountId: string;
  supplierId: string;
  amount: number;
  description?: string;
  createdBy: string;
  idempotencyKey?: string;
}

export interface PaymentVoucherService {
  createDraft(input: CreatePaymentVoucherInput): Promise<PaymentVoucherData>;
  updateDraft(
    id: string,
    input: CreatePaymentVoucherInput,
  ): Promise<PaymentVoucherData>;
  post(command: PostPaymentVoucherCommand): Promise<PaymentVoucherData>;
  createAndPost(
    input: CreatePaymentVoucherInput,
    allocations: PaymentAllocationInput[],
  ): Promise<PaymentVoucherData>;
  autoAllocateToSupplier(
    data: AutoAllocatePaymentInput,
  ): Promise<PaymentVoucherData>;
  cancel(id: string, cancelledAt: string): Promise<PaymentVoucherData>;
}

export class PaymentVoucherServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentVoucherServiceError";
  }
}

export interface PaymentVoucherServiceDependencies {
  unitOfWork: UnitOfWork;
  paymentVoucherRepository: PaymentVoucherRepository;
  purchaseInvoiceRepository: PurchaseInvoiceRepository;
  journalEntryRepository: JournalEntryRepository;
  accountingSettingRepository: AccountingSettingRepository;
  documentNumberGenerator: DocumentNumberGenerator;
}

export class PaymentVoucherServiceImpl implements PaymentVoucherService {
  constructor(private readonly deps: PaymentVoucherServiceDependencies) {}

  async createDraft(
    input: CreatePaymentVoucherInput,
  ): Promise<PaymentVoucherData> {
    this.validateCreateInput(input);
    return this.deps.unitOfWork.execute(async () => {
      return this.deps.paymentVoucherRepository.createDraft(input);
    });
  }

  async updateDraft(
    id: string,
    input: CreatePaymentVoucherInput,
  ): Promise<PaymentVoucherData> {
    this.validateId(id);
    this.validateCreateInput(input);
    return this.deps.unitOfWork.execute(async () => {
      return this.deps.paymentVoucherRepository.updateDraft(id, input);
    });
  }

  async post(
    command: PostPaymentVoucherCommand,
  ): Promise<PaymentVoucherData> {
    this.validateId(command.paymentVoucherId);
    if (!command.allocations || command.allocations.length === 0) {
      throw new PaymentVoucherServiceError(
        "Posted payment voucher must contain at least one allocation.",
      );
    }
    return this.deps.unitOfWork.execute(async () => {
      const voucher = await this.deps.paymentVoucherRepository.getById(
        command.paymentVoucherId,
      );
      if (!voucher) {
        throw new PaymentVoucherServiceError(
          `Payment voucher not found: ${command.paymentVoucherId}`,
        );
      }
      if (voucher.isCancelled) {
        throw new PaymentVoucherServiceError(
          "Cancelled payment vouchers cannot be posted.",
        );
      }
      if (voucher.status === DOCUMENT_STATUSES.POSTED) {
        return voucher;
      }
      if (voucher.status !== DOCUMENT_STATUSES.DRAFT) {
        throw new PaymentVoucherServiceError(
          `Payment voucher cannot be posted from status: ${voucher.status}`,
        );
      }

      await this.validateAllocations(voucher, command.allocations);

      const settings = await this.deps.accountingSettingRepository.get();
      if (!settings) {
        throw new PaymentVoucherServiceError(
          "Accounting settings are not configured.",
        );
      }
      if (!settings.suppliersAccountId) {
        throw new PaymentVoucherServiceError(
          "Suppliers account is not configured.",
        );
      }

      // Persist allocations and mark posted
      const postInput: PostPaymentVoucherInput = {
        id: voucher.id,
        allocations: command.allocations,
      };
      await this.deps.paymentVoucherRepository.persistPosted(postInput);

      // Update paid_amount cache on each purchase invoice
      for (const allocation of command.allocations) {
        await this.deps.purchaseInvoiceRepository.increasePaidAmount(
          allocation.purchaseInvoiceId,
          allocation.amount,
        );
      }

      // Payment journal: Supplier Dr / Cash Cr
      const journalInput: CreateJournalEntryInput = {
        entryDate: voucher.voucherDate,
        referenceType: REFERENCE_TYPES.PAYMENT_VOUCHER,
        referenceId: voucher.id,
        description: `سند صرف رقم ${voucher.voucherNumber}`,
        createdBy: voucher.createdBy,
        idempotencyKey: voucher.idempotencyKey
          ? `${voucher.idempotencyKey}:payment-journal`
          : `payment:${voucher.id}:journal`,
        lines: [
          {
            accountId: settings.suppliersAccountId,
            debit: voucher.amount,
            credit: 0,
          },
          {
            accountId: voucher.paymentAccountId,
            debit: 0,
            credit: voucher.amount,
          },
        ],
      };
      const journal = await this.deps.journalEntryRepository.createDraft(
        journalInput,
      );
      await this.deps.journalEntryRepository.post(journal.id);

      return (await this.deps.paymentVoucherRepository.getById(voucher.id))!;
    });
  }

  async createAndPost(
    input: CreatePaymentVoucherInput,
    allocations: PaymentAllocationInput[],
  ): Promise<PaymentVoucherData> {
    const draft = await this.createDraft(input);
    return this.post({ paymentVoucherId: draft.id, allocations });
  }

  async autoAllocateToSupplier(
    data: AutoAllocatePaymentInput,
  ): Promise<PaymentVoucherData> {
    this.validateAutoAllocateInput(data);

    // 1. Read open posted purchase invoices for the supplier (oldest first)
    const supplierInvoices = await this.deps.purchaseInvoiceRepository.getBySupplier(
      data.supplierId,
    );
    const openInvoices = supplierInvoices.filter(
      (inv) => !inv.isCancelled && inv.status === DOCUMENT_STATUSES.POSTED,
    );

    const documents: OutstandingDocument[] = openInvoices.map((inv) => ({
      id: inv.id,
      outstandingAmount: Math.max(inv.total - inv.paidAmount, 0),
      date: inv.invoiceDate,
    }));

    // 2. FIFO allocation via domain function
    const allocationResult = calculateOldestFirstAllocation(
      data.amount,
      documents,
    );

    const allocations: PaymentAllocationInput[] = allocationResult.map((a) => ({
      purchaseInvoiceId: a.documentId,
      amount: a.amount,
    }));

    // 3. Resolve official voucher number if missing
    let voucherNumber = data.voucherNumber;
    if (!voucherNumber || !voucherNumber.trim()) {
      voucherNumber = await this.deps.documentNumberGenerator.generate(
        DOCUMENT_PREFIXES.PAYMENT_VOUCHER,
        data.voucherDate,
      );
    }

    // 4. Create draft and post in one atomic flow
    const draft = await this.createDraft({
      voucherNumber,
      voucherDate: data.voucherDate,
      paymentAccountId: data.paymentAccountId,
      supplierId: data.supplierId,
      amount: data.amount,
      description: data.description,
      createdBy: data.createdBy,
      idempotencyKey: data.idempotencyKey,
    });

    return this.post({
      paymentVoucherId: draft.id,
      allocations,
    });
  }

  async cancel(
    id: string,
    cancelledAt: string,
  ): Promise<PaymentVoucherData> {
    this.validateId(id);
    const normalizedDate = this.normalizeDate(cancelledAt);
    return this.deps.unitOfWork.execute(async () => {
      const voucher = await this.deps.paymentVoucherRepository.getById(id);
      if (!voucher) {
        throw new PaymentVoucherServiceError(
          `Payment voucher not found: ${id}`,
        );
      }
      if (voucher.isCancelled) {
        return voucher;
      }
      if (voucher.status !== DOCUMENT_STATUSES.POSTED) {
        throw new PaymentVoucherServiceError(
          "Only posted payment vouchers can be cancelled.",
        );
      }

      // Restore purchase invoice paid_amount caches
      for (const allocation of voucher.allocations ?? []) {
        const invoice = await this.deps.purchaseInvoiceRepository.getById(
          allocation.purchaseInvoiceId,
        );
        if (invoice) {
          await this.deps.purchaseInvoiceRepository.decreasePaidAmount(
            invoice.id,
            allocation.amount,
          );
        }
      }

      // Reverse payment journal
      const journal = await this.deps.journalEntryRepository.getPostedByReference(
        REFERENCE_TYPES.PAYMENT_VOUCHER,
        voucher.id,
      );
      if (journal) {
        await this.deps.journalEntryRepository.reverse(
          journal.id,
          normalizedDate,
          `عكس سند صرف رقم ${voucher.voucherNumber ?? voucher.id}`,
        );
      }

      return this.deps.paymentVoucherRepository.markCancelled(
        voucher.id,
        normalizedDate,
      );
    });
  }

  private validateCreateInput(input: CreatePaymentVoucherInput): void {
    if (!input.voucherDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.voucherDate)) {
      throw new PaymentVoucherServiceError(
        "Invalid voucher date. Expected YYYY-MM-DD.",
      );
    }
    if (!input.voucherNumber || !input.voucherNumber.trim()) {
      throw new PaymentVoucherServiceError("Voucher number is required.");
    }
    if (!input.paymentAccountId || !input.paymentAccountId.trim()) {
      throw new PaymentVoucherServiceError("Payment account is required.");
    }
    if (!input.supplierId || !input.supplierId.trim()) {
      throw new PaymentVoucherServiceError("Supplier is required.");
    }
    if (!input.createdBy || !input.createdBy.trim()) {
      throw new PaymentVoucherServiceError("Created by is required.");
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new PaymentVoucherServiceError(
        "Voucher amount must be a positive number.",
      );
    }
  }

  private validateAutoAllocateInput(data: AutoAllocatePaymentInput): void {
    if (!data.voucherDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.voucherDate)) {
      throw new PaymentVoucherServiceError(
        "Invalid voucher date. Expected YYYY-MM-DD.",
      );
    }
    if (!data.paymentAccountId || !data.paymentAccountId.trim()) {
      throw new PaymentVoucherServiceError("Payment account is required.");
    }
    if (!data.supplierId || !data.supplierId.trim()) {
      throw new PaymentVoucherServiceError("Supplier is required.");
    }
    if (!data.createdBy || !data.createdBy.trim()) {
      throw new PaymentVoucherServiceError("Created by is required.");
    }
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new PaymentVoucherServiceError(
        "Payment amount must be greater than zero.",
      );
    }
  }

  private async validateAllocations(
    voucher: PaymentVoucherData,
    allocations: PaymentAllocationInput[],
  ): Promise<void> {
    const seen = new Set<string>();
    let totalAllocated = 0;
    for (const a of allocations) {
      if (seen.has(a.purchaseInvoiceId)) {
        throw new PaymentVoucherServiceError(
          `Purchase invoice appears more than once in allocations: ${a.purchaseInvoiceId}`,
        );
      }
      seen.add(a.purchaseInvoiceId);
      if (!Number.isFinite(a.amount) || a.amount <= 0) {
        throw new PaymentVoucherServiceError(
          "Allocation amount must be greater than zero.",
        );
      }
      const invoice = await this.deps.purchaseInvoiceRepository.getById(
        a.purchaseInvoiceId,
      );
      if (!invoice) {
        throw new PaymentVoucherServiceError(
          `Purchase invoice not found: ${a.purchaseInvoiceId}`,
        );
      }
      if (invoice.isCancelled) {
        throw new PaymentVoucherServiceError(
          `Cannot allocate payment to a cancelled invoice: ${a.purchaseInvoiceId}`,
        );
      }
      if (invoice.status !== DOCUMENT_STATUSES.POSTED) {
        throw new PaymentVoucherServiceError(
          `Cannot allocate payment to a non-posted invoice: ${a.purchaseInvoiceId}`,
        );
      }
      if (invoice.supplierId !== voucher.supplierId) {
        throw new PaymentVoucherServiceError(
          `Invoice ${a.purchaseInvoiceId} does not belong to the voucher supplier.`,
        );
      }
      const outstanding = Math.max(invoice.total - invoice.paidAmount, 0);
      if (a.amount > outstanding) {
        throw new PaymentVoucherServiceError(
          `Allocation amount (${a.amount}) exceeds outstanding balance (${outstanding}) for invoice ${a.purchaseInvoiceId}.`,
        );
      }
      totalAllocated += a.amount;
    }
    if (Math.abs(totalAllocated - voucher.amount) > 0.0001) {
      throw new PaymentVoucherServiceError(
        `Total allocations (${totalAllocated}) must equal voucher amount (${voucher.amount}).`,
      );
    }
  }

  private validateId(id: string): void {
    if (!id || !id.trim()) {
      throw new PaymentVoucherServiceError("Document id is required.");
    }
  }

  private normalizeDate(value: string): string {
    const trimmed = value?.trim();
    if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new PaymentVoucherServiceError(
        `Invalid date format: ${value}. Expected YYYY-MM-DD.`,
      );
    }
    return trimmed;
  }
}
