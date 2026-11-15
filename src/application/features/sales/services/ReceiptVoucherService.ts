import {
  DOCUMENT_PREFIXES,
  DOCUMENT_STATUSES,
  REFERENCE_TYPES,
  DocumentStatus,
} from "@core/constants";

import {
  CreateReceiptVoucherInput,
  PostReceiptVoucherInput,
  ReceiptVoucherData,
} from "@core/types/sales/receiptVoucher";

import { ReceiptVoucherRepository } from "@application/features/sales/repositories/ReceiptVoucherRepository";

import { SalesInvoiceRepository } from "@application/features/sales/repositories/SalesInvoiceRepository";

import { AccountingSettingRepository } from "@application/features/accounting/repositories/AccountingSettingRepository";

import { JournalEntryRepository } from "@application/features/accounting/repositories/JournalEntryRepository";

import { UnitOfWork } from "@application/transactions/UnitOfWork";

import { DocumentNumberGenerator } from "@application/numbering/DocumentNumberGenerator";

import { ReceiptAllocationInput } from "@core/types/sales/receiptVoucher";

export interface PostReceiptVoucherCommand {
  receiptVoucherId: string;
  allocations: ReceiptAllocationInput[];
}

export interface ReceiptVoucherService {
  createDraft(input: CreateReceiptVoucherInput): Promise<ReceiptVoucherData>;

  updateDraft(
    id: string,
    input: CreateReceiptVoucherInput,
  ): Promise<ReceiptVoucherData>;

  post(command: PostReceiptVoucherCommand): Promise<ReceiptVoucherData>;

  cancel(id: string, cancelledAt: string): Promise<ReceiptVoucherData>;
}

export interface ReceiptVoucherServiceDependencies {
  unitOfWork: UnitOfWork;

  receiptVoucherRepository: ReceiptVoucherRepository;

  salesInvoiceRepository: SalesInvoiceRepository;

  accountingSettingRepository: AccountingSettingRepository;

  journalEntryRepository: JournalEntryRepository;

  documentNumberGenerator: DocumentNumberGenerator;
}

export class ReceiptVoucherNotFoundError extends Error {
  constructor(id: string) {
    super(`Receipt voucher not found: ${id}`);
    this.name = "ReceiptVoucherNotFoundError";
  }
}

export class InvalidReceiptVoucherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReceiptVoucherError";
  }
}

export class ReceiptVoucherNotDraftError extends Error {
  constructor(id: string) {
    super(`Receipt voucher is not a draft: ${id}`);
    this.name = "ReceiptVoucherNotDraftError";
  }
}

export class ReceiptInvoiceNotFoundError extends Error {
  constructor(id: string) {
    super(`Sales invoice not found: ${id}`);
    this.name = "ReceiptInvoiceNotFoundError";
  }
}

export class ReceiptInvoiceNotReceivableError extends Error {
  constructor(id: string) {
    super(`Sales invoice is not receivable: ${id}`);
    this.name = "ReceiptInvoiceNotReceivableError";
  }
}

export class ReceiptCustomerMismatchError extends Error {
  constructor(invoiceId: string) {
    super(
      `Sales invoice does not belong to the receipt customer: ${invoiceId}`,
    );
    this.name = "ReceiptCustomerMismatchError";
  }
}

export class ReceiptAllocationExceedsBalanceError extends Error {
  constructor(invoiceId: string, requested: number, outstanding: number) {
    super(
      `Allocation exceeds invoice balance. Invoice: ${invoiceId}, requested: ${requested}, outstanding: ${outstanding}`,
    );
    this.name = "ReceiptAllocationExceedsBalanceError";
  }
}

export class ReceiptAmountMismatchError extends Error {
  constructor(amount: number, allocated: number) {
    super(
      `Receipt amount does not equal allocated amount. Receipt: ${amount}, allocated: ${allocated}`,
    );
    this.name = "ReceiptAmountMismatchError";
  }
}

export class ReceiptVoucherServiceImpl implements ReceiptVoucherService {
  constructor(
    private readonly dependencies: ReceiptVoucherServiceDependencies,
  ) {}

  async createDraft(
    input: CreateReceiptVoucherInput,
  ): Promise<ReceiptVoucherData> {
    const normalizedInput = this.normalizeCreateInput(input);

    this.validateCreateInput(normalizedInput);

    return this.dependencies.unitOfWork.execute(async () => {
      return this.dependencies.receiptVoucherRepository.createDraft(
        normalizedInput,
      );
    });
  }

  async updateDraft(
    id: string,
    input: CreateReceiptVoucherInput,
  ): Promise<ReceiptVoucherData> {
    this.validateId(id);

    const normalizedInput = this.normalizeCreateInput(input);

    this.validateCreateInput(normalizedInput);

    return this.dependencies.unitOfWork.execute(async () => {
      const voucher = await this.dependencies.receiptVoucherRepository.getById(
        id,
      );

      if (!voucher) {
        throw new ReceiptVoucherNotFoundError(id);
      }

      if (voucher.status !== DOCUMENT_STATUSES.DRAFT) {
        throw new ReceiptVoucherNotDraftError(id);
      }

      if (voucher.isCancelled) {
        throw new InvalidReceiptVoucherError(
          "Cancelled receipt voucher cannot be updated.",
        );
      }

      return this.dependencies.receiptVoucherRepository.updateDraft(
        id,
        normalizedInput,
      );
    });
  }

  async post(command: PostReceiptVoucherCommand): Promise<ReceiptVoucherData> {
    this.validateId(command.receiptVoucherId);

    return this.dependencies.unitOfWork.execute(async () => {
      const voucher = await this.dependencies.receiptVoucherRepository.getById(
        command.receiptVoucherId,
      );

      if (!voucher) {
        throw new ReceiptVoucherNotFoundError(command.receiptVoucherId);
      }

      this.validateDraftForPosting(voucher);

      const allocations = this.normalizeAllocations(command.allocations);

      this.validateAllocationsInput(allocations);

      if (!voucher.customerId) {
        throw new InvalidReceiptVoucherError(
          "Customer is required when posting a receipt voucher.",
        );
      }

      const settings =
        await this.dependencies.accountingSettingRepository.get();

      if (!settings) {
        throw new InvalidReceiptVoucherError(
          "Accounting settings are not configured.",
        );
      }

      if (!settings.customersAccountId) {
        throw new InvalidReceiptVoucherError(
          "Customer receivable account is not configured.",
        );
      }

      this.validatePaymentAccount(voucher.paymentAccountId);

      const invoiceUpdates = await this.validateAndPrepareAllocations(
        voucher,
        allocations,
      );

      const allocatedTotal = allocations.reduce(
        (sum, allocation) => sum + allocation.amount,
        0,
      );

      if (allocatedTotal !== voucher.amount) {
        throw new ReceiptAmountMismatchError(voucher.amount, allocatedTotal);
      }

      const voucherNumber =
        await this.dependencies.documentNumberGenerator.generate(
          DOCUMENT_PREFIXES.RECEIPT_VOUCHER,
          voucher.voucherDate,
        );

      const postedVoucher =
        await this.dependencies.receiptVoucherRepository.persistPosted({
          id: voucher.id,
          voucherNumber,
          allocations,
        });

      for (const update of invoiceUpdates) {
        await this.dependencies.salesInvoiceRepository.increasePaidAmount(
          update.invoiceId,
          update.newPaidAmount,
        );
      }

      const journalEntry =
        await this.dependencies.journalEntryRepository.createDraft({
          entryDate: voucher.voucherDate,
          referenceType: REFERENCE_TYPES.RECEIPT_VOUCHER,
          referenceId: voucher.id,
          description:
            voucher.description ?? `Customer receipt ${voucherNumber}`,
          createdBy: voucher.createdBy,
          idempotencyKey: voucher.idempotencyKey,
          lines: [
            {
              accountId: voucher.paymentAccountId,
              debit: voucher.amount,
              credit: 0,
            },
            {
              accountId: settings.customersAccountId,
              debit: 0,
              credit: voucher.amount,
            },
          ],
        });

      await this.dependencies.journalEntryRepository.post(journalEntry.id);

      return postedVoucher;
    });
  }

  async cancel(id: string, cancelledAt: string): Promise<ReceiptVoucherData> {
    this.validateId(id);

    if (!cancelledAt || !/^\d{4}-\d{2}-\d{2}$/.test(cancelledAt.trim())) {
      throw new InvalidReceiptVoucherError("Invalid cancellation date. Expected YYYY-MM-DD.");
    }
    const normalizedDate = cancelledAt.trim();

    return this.dependencies.unitOfWork.execute(async () => {
      const voucher = await this.dependencies.receiptVoucherRepository.getById(
        id,
      );

      if (!voucher) {
        throw new ReceiptVoucherNotFoundError(id);
      }

      if (voucher.status === DOCUMENT_STATUSES.DRAFT) {
        throw new InvalidReceiptVoucherError(
          "Draft receipt voucher should not be cancelled. Update or delete it instead.",
        );
      }

      if (voucher.isCancelled) {
        return voucher;
      }

      for (const allocation of voucher.allocations ?? []) {
        const invoice =
          await this.dependencies.salesInvoiceRepository.getById(
            allocation.salesInvoiceId,
          );
        if (invoice) {
          await this.dependencies.salesInvoiceRepository.decreasePaidAmount(
            invoice.id,
            allocation.amount,
          );
        }
      }
      const journal =
        await this.dependencies.journalEntryRepository.getPostedByReference(
          REFERENCE_TYPES.RECEIPT_VOUCHER,
          voucher.id,
        );
      if (journal) {
        await this.dependencies.journalEntryRepository.reverse(
          journal.id,
          normalizedDate,
          `عكس سند قبض رقم ${voucher.voucherNumber ?? voucher.id}`,
        );
      }
      return this.dependencies.receiptVoucherRepository.markCancelled(
        voucher.id,
        normalizedDate,
      );
    });
  }

  private async validateAndPrepareAllocations(
    voucher: ReceiptVoucherData,
    allocations: ReceiptAllocationInput[],
  ): Promise<InvoicePaidAmountUpdate[]> {
    const invoiceIds = new Set<string>();

    const updates: InvoicePaidAmountUpdate[] = [];

    for (const allocation of allocations) {
      if (invoiceIds.has(allocation.salesInvoiceId)) {
        throw new InvalidReceiptVoucherError(
          `Sales invoice appears more than once in allocations: ${allocation.salesInvoiceId}`,
        );
      }

      invoiceIds.add(allocation.salesInvoiceId);

      const invoice = await this.dependencies.salesInvoiceRepository.getById(
        allocation.salesInvoiceId,
      );

      if (!invoice) {
        throw new ReceiptInvoiceNotFoundError(allocation.salesInvoiceId);
      }

      if (invoice.status !== DOCUMENT_STATUSES.POSTED) {
        throw new ReceiptInvoiceNotReceivableError(allocation.salesInvoiceId);
      }

      if (invoice.isCancelled) {
        throw new ReceiptInvoiceNotReceivableError(allocation.salesInvoiceId);
      }

      if (!invoice.customerId) {
        throw new ReceiptInvoiceNotReceivableError(allocation.salesInvoiceId);
      }

      if (invoice.customerId !== voucher.customerId) {
        throw new ReceiptCustomerMismatchError(allocation.salesInvoiceId);
      }

      const outstanding = invoice.total - invoice.paidAmount;

      if (outstanding <= 0) {
        throw new ReceiptInvoiceNotReceivableError(allocation.salesInvoiceId);
      }

      if (allocation.amount > outstanding) {
        throw new ReceiptAllocationExceedsBalanceError(
          allocation.salesInvoiceId,
          allocation.amount,
          outstanding,
        );
      }

      updates.push({
        invoiceId: invoice.id,
        newPaidAmount: invoice.paidAmount + allocation.amount,
      });
    }

    return updates;
  }

  private normalizeCreateInput(
    input: CreateReceiptVoucherInput,
  ): CreateReceiptVoucherInput {
    return {
      voucherDate: input.voucherDate.trim(),
      paymentAccountId: input.paymentAccountId.trim(),
      customerId: input.customerId?.trim() || undefined,
      amount: input.amount,
      description: this.normalizeOptionalText(input.description),
      createdBy: input.createdBy.trim(),
      idempotencyKey: input.idempotencyKey?.trim() || undefined,
    };
  }

  private normalizeAllocations(
    allocations: ReceiptAllocationInput[],
  ): ReceiptAllocationInput[] {
    return allocations.map((allocation) => ({
      salesInvoiceId: allocation.salesInvoiceId.trim(),
      amount: allocation.amount,
    }));
  }

  private validateCreateInput(input: CreateReceiptVoucherInput): void {
    if (!input.voucherDate) {
      throw new InvalidReceiptVoucherError("Voucher date is required.");
    }

    if (!input.paymentAccountId) {
      throw new InvalidReceiptVoucherError("Payment account is required.");
    }

    if (!input.createdBy) {
      throw new InvalidReceiptVoucherError("Created by is required.");
    }

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new InvalidReceiptVoucherError(
        "Receipt amount must be greater than zero.",
      );
    }
  }

  private validateAllocationsInput(
    allocations: ReceiptAllocationInput[],
  ): void {
    if (allocations.length === 0) {
      throw new InvalidReceiptVoucherError(
        "At least one invoice allocation is required.",
      );
    }

    for (const allocation of allocations) {
      if (!allocation.salesInvoiceId) {
        throw new InvalidReceiptVoucherError("Sales invoice ID is required.");
      }

      if (!Number.isFinite(allocation.amount) || allocation.amount <= 0) {
        throw new InvalidReceiptVoucherError(
          "Allocation amount must be greater than zero.",
        );
      }
    }
  }

  private validateDraftForPosting(voucher: ReceiptVoucherData): void {
    if (voucher.status !== DOCUMENT_STATUSES.DRAFT) {
      throw new InvalidReceiptVoucherError(
        "Only draft receipt vouchers can be posted.",
      );
    }

    if (voucher.isCancelled) {
      throw new InvalidReceiptVoucherError(
        "Cancelled receipt voucher cannot be posted.",
      );
    }
  }

  private validatePaymentAccount(paymentAccountId: string): void {
    if (!paymentAccountId.trim()) {
      throw new InvalidReceiptVoucherError("Payment account is required.");
    }
  }

  private validateId(id: string): void {
    if (!id || !id.trim()) {
      throw new InvalidReceiptVoucherError("Receipt voucher ID is required.");
    }
  }

  private normalizeOptionalText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized || undefined;
  }
}

interface InvoicePaidAmountUpdate {
  invoiceId: string;
  newPaidAmount: number;
}
