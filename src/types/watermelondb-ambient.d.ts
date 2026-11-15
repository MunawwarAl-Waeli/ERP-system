declare module "@nozbe/watermelondb" {
  export class Model {
    id: string;
    destroyPermanently(): Promise<void>;
    prepareUpdate(update: (record: any) => void): any;
    prepareCreate(create: (record: any) => void): any;
    prepareDestroyPermanently(): any;
  }
  export const Q: any;
  export class Database {
    constructor(options?: any);
    get<T extends Model = Model>(tableName: string): any;
    write<T>(work: () => Promise<T>): Promise<T>;
    batch(...args: any[]): Promise<any>;
    collections: {
      get<T extends Model = Model>(tableName: string): any;
      [key: string]: any;
    };
    [key: string]: any;
  }
  export function appSchema(options: any): any;
  export function tableSchema(options: any): any;
  export type Relation<T> = any;
  export type Query<T> = any;
}

declare module "@nozbe/watermelondb/Model" {
  import { Model as RootModel } from "@nozbe/watermelondb";
  export default RootModel;
  export type Associations = any;
}

declare module "@nozbe/watermelondb/adapters/sqlite" {
  const SQLiteAdapter: any;
  export default SQLiteAdapter;
}
