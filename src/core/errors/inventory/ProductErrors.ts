export class ProductAlreadyExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductAlreadyExistsError";
  }
}

export class ProductNotFoundError extends Error {
  constructor(message = "Product not found.") {
    super(message);
    this.name = "ProductNotFoundError";
  }
}

export class InvalidProductError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProductError";
  }
}

export class ProductUnitAlreadyExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductUnitAlreadyExistsError";
  }
}

export class ProductUnitNotFoundError extends Error {
  constructor(message = "Product unit not found.") {
    super(message);
    this.name = "ProductUnitNotFoundError";
  }
}
