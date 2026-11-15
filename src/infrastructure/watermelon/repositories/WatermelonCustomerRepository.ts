import { Database, Q } from "@nozbe/watermelondb";

import Customer from "src/database/models/Customer";

import {
  CreateCustomerInput,
  CustomerData,
  CustomerSearchInput,
  UpdateCustomerInput,
} from "@core/types/sales/customer";

import type { CustomerRepository } from "@application/features/customers/repositories/customerRepository";

export class WatermelonCustomerRepository implements CustomerRepository {
  private readonly customers;

  constructor(private readonly database: Database) {
    this.customers = this.database.get<Customer>("customers");
  }

  async getById(id: string): Promise<CustomerData | null> {
    const customers = await this.customers.query(Q.where("id", id)).fetch();

    const customer = customers[0];

    if (!customer) {
      return null;
    }

    return this.toData(customer);
  }

  async getByPhone(phone: string): Promise<CustomerData | null> {
    const customers = await this.customers
      .query(Q.where("phone", phone))
      .fetch();

    const customer = customers[0];

    if (!customer) {
      return null;
    }

    return this.toData(customer);
  }

  async search(input: CustomerSearchInput): Promise<CustomerData[]> {
    const search = input.search?.trim();
    const activeOnly = input.activeOnly === true;

    const conditions: any[] = [];

    if (search) {
      const sanitizedSearch = Q.sanitizeLikeString(search);
      const pattern = `%${sanitizedSearch}%`;

      conditions.push(
        Q.or(
          Q.where("name", Q.like(pattern)),
          Q.where("phone", Q.like(pattern)),
        ),
      );
    }

    if (activeOnly) {
      conditions.push(Q.where("is_active", true));
    }

    const customers = await this.customers
      .query(...conditions, Q.sortBy("name", Q.asc))
      .fetch();

    return customers.map((customer: Customer) => this.toData(customer));
  }

  async getAll(): Promise<CustomerData[]> {
    const customers = await this.customers
      .query(Q.sortBy("name", Q.asc))
      .fetch();

    return customers.map((customer: Customer) => this.toData(customer));
  }

  async getActive(): Promise<CustomerData[]> {
    const customers = await this.customers
      .query(Q.where("is_active", true), Q.sortBy("name", Q.asc))
      .fetch();

    return customers.map((customer: Customer) => this.toData(customer));
  }

  async create(input: CreateCustomerInput): Promise<CustomerData> {
    const customer = await this.customers.create((record: { name: string; phone: string; address: string | undefined; notes: string | undefined; isActive: boolean; }) => {
      record.name = input.name;
      record.phone = input.phone;
      record.address = input.address;
      record.notes = input.notes;
      record.isActive = input.isActive;
    });

    return this.toData(customer);
  }

  async update(id: string, input: UpdateCustomerInput): Promise<CustomerData> {
    const customers = await this.customers.query(Q.where("id", id)).fetch();

    const customer = customers[0];

    if (!customer) {
      throw new Error(`Customer not found: ${id}`);
    }

    const updatedCustomer = await customer.update((record: { name: string; phone: string; address: string | undefined; notes: string | undefined; isActive: boolean; }) => {
      record.name = input.name;
      record.phone = input.phone;
      record.address = input.address;
      record.notes = input.notes;
      record.isActive = input.isActive;
    });

    return this.toData(updatedCustomer);
  }

  private toData(customer: Customer): CustomerData {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      notes: customer.notes,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}
