export interface JournalValidationLine {
  debit: number;
  credit: number;
}

export class InvalidJournalEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidJournalEntryError";
  }
}

export function validateJournalEntry(lines: JournalValidationLine[]): void {
  if (lines.length === 0) {
    throw new InvalidJournalEntryError(
      "Journal entry must contain at least one line.",
    );
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    if (line.debit < 0 || line.credit < 0) {
      throw new InvalidJournalEntryError(
        "Debit and credit amounts cannot be negative.",
      );
    }

    if (line.debit > 0 && line.credit > 0) {
      throw new InvalidJournalEntryError(
        "A journal line cannot contain both debit and credit.",
      );
    }

    if (line.debit === 0 && line.credit === 0) {
      throw new InvalidJournalEntryError(
        "A journal line must contain either a debit or a credit amount.",
      );
    }

    totalDebit += line.debit;
    totalCredit += line.credit;
  }

  if (totalDebit <= 0 || totalCredit <= 0) {
    throw new InvalidJournalEntryError(
      "Journal entry totals must be greater than zero.",
    );
  }

  if (totalDebit !== totalCredit) {
    throw new InvalidJournalEntryError("Total debit must equal total credit.");
  }
}
