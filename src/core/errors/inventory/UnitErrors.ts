export class UnitAlreadyExistsError extends Error {
  constructor(message = "Unit code already exists.") {
    super(message);
    this.name = "UnitAlreadyExistsError";
  }
}

export class UnitNotFoundError extends Error {
  constructor(message = "Unit not found.") {
    super(message);
    this.name = "UnitNotFoundError";
  }
}

export class InvalidUnitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUnitError";
  }
}
