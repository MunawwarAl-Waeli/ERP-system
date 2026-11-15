export interface CustomerData {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  isActive: boolean;
}

export interface UpdateCustomerInput {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  isActive: boolean;
}

export interface CustomerSearchInput {
  search?: string;
  activeOnly?: boolean;
}
