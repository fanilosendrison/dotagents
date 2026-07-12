export class HarnessPreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HarnessPreflightError";
  }
}

export class HarnessSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HarnessSetupError";
  }
}

export class HarnessNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HarnessNormalizationError";
  }
}

export class HarnessPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HarnessPersistenceError";
  }
}
