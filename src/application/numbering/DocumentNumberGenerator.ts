import { DocumentPrefix } from "../../core/constants";

export interface DocumentNumberGenerator {
  generate(prefix: DocumentPrefix, date: string): Promise<string>;
}
