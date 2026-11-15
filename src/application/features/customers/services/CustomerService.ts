import {
  CreateCustomerInput,
  CustomerData,
  CustomerSearchInput,
  UpdateCustomerInput,
} from "@core/types/sales/customer";

export interface CustomerService {
  create(input: CreateCustomerInput): Promise<CustomerData>;

  update(
    id: string,
    input: UpdateCustomerInput,
  ): Promise<CustomerData>;

  activate(id: string): Promise<CustomerData>;

  deactivate(id: string): Promise<CustomerData>;

  getById(id: string): Promise<CustomerData>;

  search(input: CustomerSearchInput): Promise<CustomerData[]>;
}


import { CustomerRepository } from "@application/features/customers/repositories/customerRepository";
import { UnitOfWork } from "@application/transactions/UnitOfWork";

export class CustomerNotFoundError extends Error {
  constructor(customerId: string) {
    super(`Customer not found: ${customerId}`);
    this.name = "CustomerNotFoundError";
  }
}

export class CustomerPhoneAlreadyExistsError extends Error {
  constructor(phone: string) {
    super(`Customer phone already exists: ${phone}`);
    this.name = "CustomerPhoneAlreadyExistsError";
  }
}

export class InvalidCustomerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCustomerError";
  }
}

export interface CustomerServiceDependencies {
  customerRepository: CustomerRepository;
  unitOfWork: UnitOfWork;
}

export class CustomerServiceImpl implements CustomerService {
  constructor(private readonly dependencies: CustomerServiceDependencies) {}

  async create(input: CreateCustomerInput): Promise<CustomerData> {
    const normalizedInput = this.normalizeCreateInput(input);

    this.validateCreateInput(normalizedInput);

    return this.dependencies.unitOfWork.execute(async () => {
      const existingCustomer =
        await this.dependencies.customerRepository.getByPhone(
          normalizedInput.phone,
        );

      if (existingCustomer) {
        throw new CustomerPhoneAlreadyExistsError(normalizedInput.phone);
      }

      return this.dependencies.customerRepository.create(normalizedInput);
    });
  }

  async update(id: string, input: UpdateCustomerInput): Promise<CustomerData> {
    this.validateId(id);

    const normalizedInput = this.normalizeUpdateInput(input);

    this.validateUpdateInput(normalizedInput);

    return this.dependencies.unitOfWork.execute(async () => {
      const customer = await this.dependencies.customerRepository.getById(id);

      if (!customer) {
        throw new CustomerNotFoundError(id);
      }

      const existingCustomer =
        await this.dependencies.customerRepository.getByPhone(
          normalizedInput.phone,
        );

      if (existingCustomer && existingCustomer.id !== id) {
        throw new CustomerPhoneAlreadyExistsError(normalizedInput.phone);
      }

      return this.dependencies.customerRepository.update(id, normalizedInput);
    });
  }

  async activate(id: string): Promise<CustomerData> {
    this.validateId(id);

    return this.dependencies.unitOfWork.execute(async () => {
      const customer = await this.dependencies.customerRepository.getById(id);

      if (!customer) {
        throw new CustomerNotFoundError(id);
      }

      if (customer.isActive) {
        return customer;
      }

      return this.dependencies.customerRepository.update(id, {
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        notes: customer.notes,
        isActive: true,
      });
    });
  }

  async deactivate(id: string): Promise<CustomerData> {
    this.validateId(id);

    return this.dependencies.unitOfWork.execute(async () => {
      const customer = await this.dependencies.customerRepository.getById(id);

      if (!customer) {
        throw new CustomerNotFoundError(id);
      }

      if (!customer.isActive) {
        return customer;
      }

      return this.dependencies.customerRepository.update(id, {
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        notes: customer.notes,
        isActive: false,
      });
    });
  }

  async getById(id: string): Promise<CustomerData> {
    this.validateId(id);

    const customer = await this.dependencies.customerRepository.getById(id);

    if (!customer) {
      throw new CustomerNotFoundError(id);
    }

    return customer;
  }

  async search(input: CustomerSearchInput): Promise<CustomerData[]> {
    const normalizedInput = this.normalizeSearchInput(input);

    return this.dependencies.customerRepository.search(normalizedInput);
  }

  private normalizeCreateInput(
    input: CreateCustomerInput,
  ): CreateCustomerInput {
    return {
      name: input.name.trim(),
      phone: input.phone.trim(),
      address: this.normalizeOptionalText(input.address),
      notes: this.normalizeOptionalText(input.notes),
      isActive: input.isActive,
    };
  }

  private normalizeUpdateInput(
    input: UpdateCustomerInput,
  ): UpdateCustomerInput {
    return {
      name: input.name.trim(),
      phone: input.phone.trim(),
      address: this.normalizeOptionalText(input.address),
      notes: this.normalizeOptionalText(input.notes),
      isActive: input.isActive,
    };
  }

  private normalizeSearchInput(
    input: CustomerSearchInput,
  ): CustomerSearchInput {
    return {
      search: input.search?.trim() || undefined,
      activeOnly: input.activeOnly,
    };
  }

  private normalizeOptionalText(value?: string): string | undefined {
    const normalized = value?.trim();

    return normalized || undefined;
  }

  private validateCreateInput(input: CreateCustomerInput): void {
    this.validateCommonInput(input);

    if (typeof input.isActive !== "boolean") {
      throw new InvalidCustomerError(
        "Customer active status must be a boolean.",
      );
    }
  }

  private validateUpdateInput(input: UpdateCustomerInput): void {
    this.validateCommonInput(input);

    if (typeof input.isActive !== "boolean") {
      throw new InvalidCustomerError(
        "Customer active status must be a boolean.",
      );
    }
  }

  private validateCommonInput(
    input: CreateCustomerInput | UpdateCustomerInput,
  ): void {
    if (!input.name) {
      throw new InvalidCustomerError("Customer name is required.");
    }

    if (!input.phone) {
      throw new InvalidCustomerError("Customer phone is required.");
    }
  }

  private validateId(id: string): void {
    if (!id || !id.trim()) {
      throw new InvalidCustomerError("Customer ID is required.");
    }
  }
}
