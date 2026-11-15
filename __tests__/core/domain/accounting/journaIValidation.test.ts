import {
  InvalidJournalEntryError,
  validateJournalEntry,
} from "@core/domain/accounting/journalValidation";

describe("validateJournalEntry", () => {
  it("accepts a balanced journal entry", () => {
    expect(() =>
      validateJournalEntry([
        { debit: 1000, credit: 0 },
        { debit: 0, credit: 1000 },
      ]),
    ).not.toThrow();
  });

  it("accepts multiple balanced lines", () => {
    expect(() =>
      validateJournalEntry([
        { debit: 1000, credit: 0 },
        { debit: 500, credit: 0 },
        { debit: 0, credit: 1500 },
      ]),
    ).not.toThrow();
  });

  it("rejects an empty journal entry", () => {
    expect(() => validateJournalEntry([])).toThrow(InvalidJournalEntryError);
  });

  it("rejects when total debit does not equal total credit", () => {
    expect(() =>
      validateJournalEntry([
        { debit: 1000, credit: 0 },
        { debit: 0, credit: 900 },
      ]),
    ).toThrow(InvalidJournalEntryError);
  });

  it("rejects a line containing both debit and credit", () => {
    expect(() => validateJournalEntry([{ debit: 1000, credit: 1000 }])).toThrow(
      InvalidJournalEntryError,
    );
  });

  it("rejects a line containing neither debit nor credit", () => {
    expect(() => validateJournalEntry([{ debit: 0, credit: 0 }])).toThrow(
      InvalidJournalEntryError,
    );
  });

  it("rejects negative debit", () => {
    expect(() =>
      validateJournalEntry([
        { debit: -100, credit: 0 },
        { debit: 0, credit: 100 },
      ]),
    ).toThrow(InvalidJournalEntryError);
  });

  it("rejects negative credit", () => {
    expect(() =>
      validateJournalEntry([
        { debit: 100, credit: 0 },
        { debit: 0, credit: -100 },
      ]),
    ).toThrow(InvalidJournalEntryError);
  });

  it("rejects when total debit is zero", () => {
    expect(() => validateJournalEntry([{ debit: 0, credit: 1000 }])).toThrow(
      InvalidJournalEntryError,
    );
  });

  it("rejects when total credit is zero", () => {
    expect(() => validateJournalEntry([{ debit: 1000, credit: 0 }])).toThrow(
      InvalidJournalEntryError,
    );
  });
});
