import {
  DOCUMENT_PREFIXES,
  DOCUMENT_STATUSES,
  PAYMENT_TYPES,
  REFERENCE_TYPES,
  STOCK_MOVEMENT_TYPES,
} from "@core/constants";

import {
  PurchaseInvoiceServiceError,
  PurchaseInvoiceServiceImpl,
  PurchaseInvoiceServiceDependencies,
} from "@application/features/purchase/services/PurchaseInvoiceService";

import {
  CreatePurchaseInvoiceInput,
  PurchaseInvoiceData,
} from "@core/types/purchases/purchaseInvoice";

import { PaymentVoucherData } from "@core/types/purchases/paymentVoucher";

describe("PurchaseInvoiceServiceImpl", () => {
  let service: PurchaseInvoiceServiceImpl;

  let deps: jest.Mocked<PurchaseInvoiceServiceDependencies>;

  const invoiceDate = "2026-10-01";

  const supplierId = "supplier-1";
  const productId = "product-1";
  const productUnitId = "product-unit-1";
  const invoiceId = "invoice-1";

  const inventoryAccountId = "inventory-account-1";
  const suppliersAccountId = "suppliers-account-1";
  const cashAccountId = "cash-account-1";

  const product = {
    id: productId,
    name: "بذور فاصوليا",
    inventoryAccountId,
    isActive: true,
  };

  const productUnit = {
    id: productUnitId,
    productId,
    conversionFactor: 12,
    salePrice: 15000,
    purchasePrice: 12000,
  };

  const baseInvoice = (
    overrides: Partial<PurchaseInvoiceData> = {},
  ): PurchaseInvoiceData => ({
    id: invoiceId,
    invoiceNumber: undefined,
    invoiceDate,
    paymentType: PAYMENT_TYPES.CREDIT,
    status: DOCUMENT_STATUSES.DRAFT,
    supplierId,
    total: 120000,
    paidAmount: 0,
    createdBy: "user-1",
    idempotencyKey: "idem-1",
    isCancelled: false,
    items: [
      {
        id: "invoice-item-1",
        productId,
        productUnitId,
        quantity: 10,
        unitCost: 12000,
        total: 120000,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  const baseInput = (
    overrides: Partial<CreatePurchaseInvoiceInput> = {},
  ): CreatePurchaseInvoiceInput => ({
    invoiceDate,
    paymentType: PAYMENT_TYPES.CREDIT,
    supplierId,
    createdBy: "user-1",
    idempotencyKey: "idem-1",
    items: [
      {
        productId,
        productUnitId,
        quantity: 10,
        unitCost: 12000,
        total: 120000,
      },
    ],
    ...overrides,
  });

  const postedInvoice = (
    overrides: Partial<PurchaseInvoiceData> = {},
  ): PurchaseInvoiceData => ({
    id: invoiceId,
    invoiceNumber: "PI-20261001-000001",
    invoiceDate,
    paymentType: PAYMENT_TYPES.CREDIT,
    status: DOCUMENT_STATUSES.POSTED,
    supplierId,
    total: 120000,
    paidAmount: 0,
    createdBy: "user-1",
    idempotencyKey: "idem-1",
    isCancelled: false,
    items: [
      {
        id: "invoice-item-1",
        productId,
        productUnitId,
        quantity: 10,
        unitCost: 12000,
        total: 120000,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  const cancelledInvoice = (
    overrides: Partial<PurchaseInvoiceData> = {},
  ): PurchaseInvoiceData =>
    baseInvoice({
      status: DOCUMENT_STATUSES.CANCELLED,
      isCancelled: true,
      ...overrides,
    });

  const paymentVoucher = (
    overrides: Partial<PaymentVoucherData> = {},
  ): PaymentVoucherData => ({
    id: "payment-voucher-1",
    voucherNumber: "PV-20261001-000001",
    voucherDate: invoiceDate,
    paymentAccountId: cashAccountId,
    supplierId,
    amount: 50000,
    status: DOCUMENT_STATUSES.POSTED,
    createdBy: "user-1",
    idempotencyKey: "idem-1:auto-payment",
    isCancelled: false,
    allocations: [
      {
        id: "allocation-1",
        purchaseInvoiceId: invoiceId,
        amount: 50000,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    deps = {
      unitOfWork: {
        execute: jest.fn(async <T>(work: () => Promise<T>) => work()),
      },

      purchaseInvoiceRepository: {
        getById: jest.fn(),
        getByNumber: jest.fn(),
        getByIdempotencyKey: jest.fn(),
        getBySupplier: jest.fn(),
        getByDateRange: jest.fn(),
        getDrafts: jest.fn(),
        getPosted: jest.fn(),
        createDraft: jest.fn(),
        updateDraft: jest.fn(),
        markPosted: jest.fn(),
        markCancelled: jest.fn(),
        increasePaidAmount: jest.fn(),
      },

      productRepository: {
        getById: jest.fn(),
        getUnitById: jest.fn(),
      },

      inventoryRepository: {
        getBatchById: jest.fn(),
        getAvailableBatches: jest.fn(),
        getBatchesByProduct: jest.fn(),
        createBatch: jest.fn(),
        consumeBatches: jest.fn(),
        restoreBatches: jest.fn(),
        createMovement: jest.fn(),
        createMovements: jest.fn(),
        getMovementsByProduct: jest.fn(),
        getMovementsByReference: jest.fn(),
      },

      paymentVoucherRepository: {
        getById: jest.fn(),
        getByNumber: jest.fn(),
        getBySupplier: jest.fn(),
        getByDateRange: jest.fn(),
        getDrafts: jest.fn(),
        getPosted: jest.fn(),
        createDraft: jest.fn(),
        updateDraft: jest.fn(),
        persistPosted: jest.fn(),
        markCancelled: jest.fn(),
      },

      journalEntryRepository: {
        getById: jest.fn(),
        getByReference: jest.fn(),
        getByIdempotencyKey: jest.fn(),
        createDraft: jest.fn(),
        post: jest.fn(),
        reverse: jest.fn(),
      },

      accountingSettingRepository: {
        get: jest.fn(),
      },

      documentNumberGenerator: {
        generate: jest.fn(),
      },
    } as unknown as jest.Mocked<PurchaseInvoiceServiceDependencies>;

    service = new PurchaseInvoiceServiceImpl(deps);

    deps.purchaseInvoiceRepository.getById.mockResolvedValue(baseInvoice());

    deps.productRepository.getById.mockResolvedValue(product);

    deps.productRepository.getUnitById.mockResolvedValue(productUnit);

    deps.accountingSettingRepository.get.mockResolvedValue({
      suppliersAccountId,
      cashDefaultAccountId: cashAccountId,
    } as never);

    deps.documentNumberGenerator.generate
      .mockResolvedValueOnce("PI-20261001-000001")
      .mockResolvedValueOnce("PV-20261001-000001");

    deps.inventoryRepository.createBatch.mockResolvedValue({
      id: "batch-1",
      productId,
      quantityRemaining: 120,
      unitCost: 1000,
      receivedDate: invoiceDate,
    });

    deps.inventoryRepository.createMovements.mockResolvedValue([]);

    deps.journalEntryRepository.createDraft
      .mockResolvedValueOnce({
        id: "purchase-journal-1",
      } as never)
      .mockResolvedValueOnce({
        id: "payment-journal-1",
      } as never);

    deps.paymentVoucherRepository.createDraft.mockResolvedValue(
      paymentVoucher(),
    );

    deps.paymentVoucherRepository.persistPosted.mockResolvedValue(
      paymentVoucher(),
    );

    deps.purchaseInvoiceRepository.increasePaidAmount.mockResolvedValue(
      baseInvoice({
        paidAmount: 50000,
      }),
    );

    deps.purchaseInvoiceRepository.markPosted.mockResolvedValue(
      postedInvoice(),
    );
  });

  describe("createDraft", () => {
    it("creates a new draft when idempotency key does not already exist", async () => {
      const input = baseInput();

      deps.purchaseInvoiceRepository.getByIdempotencyKey.mockResolvedValue(
        null,
      );

      deps.purchaseInvoiceRepository.createDraft.mockResolvedValue(
        baseInvoice(),
      );

      const result = await service.createDraft(input);

      expect(
        deps.purchaseInvoiceRepository.getByIdempotencyKey,
      ).toHaveBeenCalledWith("idem-1");

      expect(deps.purchaseInvoiceRepository.createDraft).toHaveBeenCalledWith(
        input,
      );

      expect(result.id).toBe(invoiceId);

      expect(deps.unitOfWork.execute).toHaveBeenCalledTimes(1);
    });

    it("returns the existing invoice when idempotency key already exists", async () => {
      const existing = baseInvoice();

      deps.purchaseInvoiceRepository.getByIdempotencyKey.mockResolvedValue(
        existing,
      );

      const result = await service.createDraft(baseInput());

      expect(result).toBe(existing);

      expect(deps.purchaseInvoiceRepository.createDraft).not.toHaveBeenCalled();
    });

    it("rejects a draft without supplier", async () => {
      const input = baseInput({
        supplierId: "",
      });

      await expect(service.createDraft(input)).rejects.toThrow(
        PurchaseInvoiceServiceError,
      );

      expect(deps.purchaseInvoiceRepository.createDraft).not.toHaveBeenCalled();
    });

    it("rejects a draft without items", async () => {
      const input = baseInput({
        items: [],
      });

      await expect(service.createDraft(input)).rejects.toThrow(
        "Purchase invoice must contain at least one item.",
      );
    });

    it("rejects invalid item quantity", async () => {
      const input = baseInput();

      input.items[0].quantity = 0;

      await expect(service.createDraft(input)).rejects.toThrow(
        "Item quantity must be greater than zero.",
      );
    });

    it("rejects invalid item cost", async () => {
      const input = baseInput();

      input.items[0].unitCost = 0;

      await expect(service.createDraft(input)).rejects.toThrow(
        "Item unit cost must be greater than zero.",
      );
    });
  });

  describe("updateDraft", () => {
    it("updates an existing draft", async () => {
      const input = baseInput();

      const updated = baseInvoice({
        paymentType: PAYMENT_TYPES.PARTIAL,
      });

      deps.purchaseInvoiceRepository.getById.mockResolvedValue(baseInvoice());

      deps.purchaseInvoiceRepository.updateDraft.mockResolvedValue(updated);

      const result = await service.updateDraft(invoiceId, input);

      expect(deps.purchaseInvoiceRepository.updateDraft).toHaveBeenCalledWith(
        invoiceId,
        input,
      );

      expect(result).toBe(updated);
    });

    it("rejects updating a missing invoice", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(null);

      await expect(service.updateDraft(invoiceId, baseInput())).rejects.toThrow(
        "Purchase invoice not found.",
      );

      expect(deps.purchaseInvoiceRepository.updateDraft).not.toHaveBeenCalled();
    });

    it("rejects updating a posted invoice", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(postedInvoice());

      await expect(service.updateDraft(invoiceId, baseInput())).rejects.toThrow(
        "Only draft purchase invoices can be updated.",
      );

      expect(deps.purchaseInvoiceRepository.updateDraft).not.toHaveBeenCalled();
    });

    it("rejects updating a cancelled invoice", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        cancelledInvoice(),
      );

      await expect(service.updateDraft(invoiceId, baseInput())).rejects.toThrow(
        "Cancelled purchase invoices cannot be updated.",
      );

      expect(deps.purchaseInvoiceRepository.updateDraft).not.toHaveBeenCalled();
    });
  });

  describe("post - credit purchase", () => {
    beforeEach(() => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        baseInvoice({
          paymentType: PAYMENT_TYPES.CREDIT,
          total: 120000,
          paidAmount: 0,
        }),
      );
    });

    it("posts a credit purchase without creating payment", async () => {
      const result = await service.post(invoiceId);

      expect(deps.documentNumberGenerator.generate).toHaveBeenCalledWith(
        DOCUMENT_PREFIXES.PURCHASE_INVOICE,
        invoiceDate,
      );

      expect(deps.inventoryRepository.createBatch).toHaveBeenCalledWith({
        productId,
        purchaseItemId: "invoice-item-1",
        quantityReceived: 120,
        quantityRemaining: 120,
        unitCost: 1000,
        receivedDate: invoiceDate,
      });

      expect(deps.inventoryRepository.createMovements).toHaveBeenCalledWith([
        {
          productId,
          productUnitId,
          quantity: 120,
          movementType: STOCK_MOVEMENT_TYPES.PURCHASE_IN,
          referenceType: REFERENCE_TYPES.PURCHASE_INVOICE,
          referenceId: invoiceId,
          unitCost: 1000,
          movementDate: invoiceDate,
        },
      ]);

      expect(deps.journalEntryRepository.createDraft).toHaveBeenCalledWith({
        entryDate: invoiceDate,
        referenceType: REFERENCE_TYPES.PURCHASE_INVOICE,
        referenceId: invoiceId,
        description: "Purchase invoice PI-20261001-000001",
        createdBy: "user-1",
        idempotencyKey: "idem-1:purchase-journal",
        lines: [
          {
            accountId: inventoryAccountId,
            debit: 120000,
            credit: 0,
          },
          {
            accountId: suppliersAccountId,
            debit: 0,
            credit: 120000,
          },
        ],
      });

      expect(deps.journalEntryRepository.post).toHaveBeenCalledWith(
        "purchase-journal-1",
      );

      expect(deps.paymentVoucherRepository.createDraft).not.toHaveBeenCalled();

      expect(
        deps.purchaseInvoiceRepository.increasePaidAmount,
      ).not.toHaveBeenCalled();

      expect(deps.purchaseInvoiceRepository.markPosted).toHaveBeenCalledWith(
        invoiceId,
        "PI-20261001-000001",
      );

      expect(result.status).toBe(DOCUMENT_STATUSES.POSTED);
    });
  });

  describe("post - cash purchase", () => {
    beforeEach(() => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        baseInvoice({
          paymentType: PAYMENT_TYPES.CASH,
          total: 120000,
          paidAmount: 0,
        }),
      );

      deps.purchaseInvoiceRepository.markPosted.mockResolvedValue(
        postedInvoice({
          paymentType: PAYMENT_TYPES.CASH,
          paidAmount: 120000,
        }),
      );

      deps.paymentVoucherRepository.createDraft.mockResolvedValue(
        paymentVoucher({
          amount: 120000,
          allocations: [
            {
              id: "allocation-1",
              purchaseInvoiceId: invoiceId,
              amount: 120000,
            },
          ],
        }),
      );

      deps.paymentVoucherRepository.persistPosted.mockResolvedValue(
        paymentVoucher({
          amount: 120000,
          allocations: [
            {
              id: "allocation-1",
              purchaseInvoiceId: invoiceId,
              amount: 120000,
            },
          ],
        }),
      );

      deps.purchaseInvoiceRepository.increasePaidAmount.mockResolvedValue(
        baseInvoice({
          paymentType: PAYMENT_TYPES.CASH,
          paidAmount: 120000,
        }),
      );
    });

    it("creates automatic payment for a cash purchase", async () => {
      await service.post(invoiceId);

      expect(deps.documentNumberGenerator.generate).toHaveBeenNthCalledWith(
        1,
        DOCUMENT_PREFIXES.PURCHASE_INVOICE,
        invoiceDate,
      );

      expect(deps.documentNumberGenerator.generate).toHaveBeenNthCalledWith(
        2,
        DOCUMENT_PREFIXES.PAYMENT_VOUCHER,
        invoiceDate,
      );

      expect(deps.paymentVoucherRepository.createDraft).toHaveBeenCalledWith({
        voucherNumber: "PV-20261001-000001",
        voucherDate: invoiceDate,
        paymentAccountId: cashAccountId,
        supplierId,
        amount: 120000,
        description: "Auto-payment for purchase invoice PI-20261001-000001",
        createdBy: "user-1",
        idempotencyKey: "idem-1:auto-payment",
      });

      expect(deps.paymentVoucherRepository.persistPosted).toHaveBeenCalledWith({
        id: "payment-voucher-1",
        allocations: [
          {
            purchaseInvoiceId: invoiceId,
            amount: 120000,
          },
        ],
      });

      expect(
        deps.purchaseInvoiceRepository.increasePaidAmount,
      ).toHaveBeenCalledWith(invoiceId, 120000);
    });

    it("creates supplier debit and cash credit payment journal", async () => {
      await service.post(invoiceId);

      expect(deps.journalEntryRepository.createDraft).toHaveBeenNthCalledWith(
        2,
        {
          entryDate: invoiceDate,
          referenceType: REFERENCE_TYPES.PAYMENT_VOUCHER,
          referenceId: "payment-voucher-1",
          description: "Payment for purchase invoice PI-20261001-000001",
          createdBy: "user-1",
          idempotencyKey: "idem-1:auto-payment-journal",
          lines: [
            {
              accountId: suppliersAccountId,
              debit: 120000,
              credit: 0,
            },
            {
              accountId: cashAccountId,
              debit: 0,
              credit: 120000,
            },
          ],
        },
      );

      expect(deps.journalEntryRepository.post).toHaveBeenCalledWith(
        "payment-journal-1",
      );
    });
  });

  describe("post - partial purchase", () => {
    beforeEach(() => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        baseInvoice({
          paymentType: PAYMENT_TYPES.PARTIAL,
          total: 120000,
          paidAmount: 0,
        }),
      );

      deps.documentNumberGenerator.generate
        .mockReset()
        .mockResolvedValueOnce("PI-20261001-000001")
        .mockResolvedValueOnce("PV-20261001-000001");

      deps.paymentVoucherRepository.createDraft.mockResolvedValue(
        paymentVoucher({
          amount: 50000,
        }),
      );

      deps.paymentVoucherRepository.persistPosted.mockResolvedValue(
        paymentVoucher({
          amount: 50000,
        }),
      );

      deps.purchaseInvoiceRepository.increasePaidAmount.mockResolvedValue(
        baseInvoice({
          paymentType: PAYMENT_TYPES.PARTIAL,
          paidAmount: 50000,
        }),
      );
    });

    it("creates only the requested partial payment", async () => {
      await service.post(invoiceId, 50000);

      expect(deps.paymentVoucherRepository.createDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50000,
        }),
      );

      expect(deps.paymentVoucherRepository.persistPosted).toHaveBeenCalledWith({
        id: "payment-voucher-1",
        allocations: [
          {
            purchaseInvoiceId: invoiceId,
            amount: 50000,
          },
        ],
      });

      expect(
        deps.purchaseInvoiceRepository.increasePaidAmount,
      ).toHaveBeenCalledWith(invoiceId, 50000);
    });
  });

  describe("payment validation", () => {
    it("rejects partial payment when amount is missing", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        baseInvoice({
          paymentType: PAYMENT_TYPES.PARTIAL,
        }),
      );

      await expect(service.post(invoiceId)).rejects.toThrow(
        "Partial purchase requires a payment amount.",
      );
    });

    it("rejects partial payment equal to invoice total", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        baseInvoice({
          paymentType: PAYMENT_TYPES.PARTIAL,
          total: 120000,
        }),
      );

      await expect(service.post(invoiceId, 120000)).rejects.toThrow(
        "Partial payment must be less than the invoice total.",
      );
    });

    it("rejects partial payment greater than invoice total", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        baseInvoice({
          paymentType: PAYMENT_TYPES.PARTIAL,
          total: 120000,
        }),
      );

      await expect(service.post(invoiceId, 130000)).rejects.toThrow(
        "Partial payment must be less than the invoice total.",
      );
    });

    it("rejects negative payment", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        baseInvoice({
          paymentType: PAYMENT_TYPES.PARTIAL,
        }),
      );

      await expect(service.post(invoiceId, -1)).rejects.toThrow(
        "Payment amount must be a valid non-negative number.",
      );
    });

    it("rejects a cash payment different from invoice total", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        baseInvoice({
          paymentType: PAYMENT_TYPES.CASH,
          total: 120000,
        }),
      );

      await expect(service.post(invoiceId, 50000)).rejects.toThrow(
        "Cash purchase payment must equal the invoice total.",
      );
    });

    it("rejects immediate payment on a credit purchase", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        baseInvoice({
          paymentType: PAYMENT_TYPES.CREDIT,
        }),
      );

      await expect(service.post(invoiceId, 50000)).rejects.toThrow(
        "Credit purchase cannot have an immediate payment.",
      );
    });
  });

  describe("post validation", () => {
    it("rejects a missing invoice", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(null);

      await expect(service.post(invoiceId)).rejects.toThrow(
        "Purchase invoice not found.",
      );
    });

    it("rejects an already posted invoice", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(postedInvoice());

      await expect(service.post(invoiceId)).rejects.toThrow(
        "Only draft purchase invoices can be posted.",
      );
    });

    it("rejects a cancelled invoice", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        cancelledInvoice(),
      );

      await expect(service.post(invoiceId)).rejects.toThrow(
        "Cancelled purchase invoices cannot be posted.",
      );

      expect(deps.inventoryRepository.createBatch).not.toHaveBeenCalled();

      expect(deps.journalEntryRepository.createDraft).not.toHaveBeenCalled();
    });

    it("rejects an invoice without supplier", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        baseInvoice({
          supplierId: "",
        }),
      );

      await expect(service.post(invoiceId)).rejects.toThrow(
        "Supplier is required for purchase invoice posting.",
      );

      expect(deps.inventoryRepository.createBatch).not.toHaveBeenCalled();
    });

    it("rejects when accounting settings are missing", async () => {
      deps.accountingSettingRepository.get.mockResolvedValue(null);

      await expect(service.post(invoiceId)).rejects.toThrow(
        "Accounting settings are not configured.",
      );
    });

    it("rejects when supplier account is missing", async () => {
      deps.accountingSettingRepository.get.mockResolvedValue({
        suppliersAccountId: "",
        cashDefaultAccountId: cashAccountId,
      } as never);

      await expect(service.post(invoiceId)).rejects.toThrow(
        "Suppliers account is not configured.",
      );
    });

    it("rejects cash purchase when cash account is missing", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        baseInvoice({
          paymentType: PAYMENT_TYPES.CASH,
        }),
      );

      deps.accountingSettingRepository.get.mockResolvedValue({
        suppliersAccountId,
        cashDefaultAccountId: "",
      } as never);

      await expect(service.post(invoiceId)).rejects.toThrow(
        "Default cash account is not configured.",
      );

      expect(deps.paymentVoucherRepository.createDraft).not.toHaveBeenCalled();
    });

    it("rejects when product does not exist", async () => {
      deps.productRepository.getById.mockResolvedValue(null);

      await expect(service.post(invoiceId)).rejects.toThrow(
        `Product not found: ${productId}`,
      );

      expect(deps.inventoryRepository.createBatch).not.toHaveBeenCalled();
    });

    it("rejects inactive product", async () => {
      deps.productRepository.getById.mockResolvedValue({
        ...product,
        isActive: false,
      });

      await expect(service.post(invoiceId)).rejects.toThrow(
        "Product is inactive: بذور فاصوليا",
      );

      expect(deps.inventoryRepository.createBatch).not.toHaveBeenCalled();
    });

    it("rejects missing product unit", async () => {
      deps.productRepository.getUnitById.mockResolvedValue(null);

      await expect(service.post(invoiceId)).rejects.toThrow(
        `Product unit not found: ${productUnitId}`,
      );

      expect(deps.inventoryRepository.createBatch).not.toHaveBeenCalled();
    });
  });

  describe("unit conversion", () => {
    it("converts carton quantity into pieces", async () => {
      await service.post(invoiceId);

      expect(deps.inventoryRepository.createBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          quantityReceived: 120,
          quantityRemaining: 120,
        }),
      );
    });

    it("uses base-unit cost for FIFO batch", async () => {
      await service.post(invoiceId);

      expect(deps.inventoryRepository.createBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          unitCost: 1000,
        }),
      );
    });
  });

  describe("idempotency and transaction boundary", () => {
    it("executes posting inside one UnitOfWork", async () => {
      await service.post(invoiceId);

      expect(deps.unitOfWork.execute).toHaveBeenCalledTimes(1);
    });

    it("does not generate a new invoice number when one already exists", async () => {
      const invoiceWithNumber = baseInvoice({
        invoiceNumber: "PI-20261001-000099",
      });

      deps.purchaseInvoiceRepository.getById.mockResolvedValue(
        invoiceWithNumber,
      );

      await service.post(invoiceId);

      expect(deps.documentNumberGenerator.generate).not.toHaveBeenCalledWith(
        DOCUMENT_PREFIXES.PURCHASE_INVOICE,
        invoiceDate,
      );

      expect(deps.purchaseInvoiceRepository.markPosted).toHaveBeenCalledWith(
        invoiceId,
        "PI-20261001-000099",
      );
    });

    it("does not post anything when invoice validation fails before processing", async () => {
      deps.purchaseInvoiceRepository.getById.mockResolvedValue(postedInvoice());

      await expect(service.post(invoiceId)).rejects.toThrow();

      expect(deps.inventoryRepository.createBatch).not.toHaveBeenCalled();

      expect(deps.inventoryRepository.createMovements).not.toHaveBeenCalled();

      expect(deps.journalEntryRepository.createDraft).not.toHaveBeenCalled();

      expect(deps.paymentVoucherRepository.createDraft).not.toHaveBeenCalled();
    });
  });
});
