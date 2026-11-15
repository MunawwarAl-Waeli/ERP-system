export interface SupplierData {
  id: string;
  name: string;
  phone?: string|null;
  address?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSupplierInput {
  name: string;
  phone?: string;
  address?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  phone?: string;
  address?: string;
}
