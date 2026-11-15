export interface UnitData {
  id: string;
  code: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateUnitInput {
  code: string;
  name: string;
}

export interface UpdateUnitInput {
  code: string;
  name: string;
}
