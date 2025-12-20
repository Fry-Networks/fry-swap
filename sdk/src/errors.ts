/**
 * Base error class for FrySwap SDK
 */
export class FrySwapError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'FrySwapError';
  }
}

/**
 * Error when pool is not found
 */
export class PoolNotFoundError extends FrySwapError {
  constructor(assetA: number, assetB: number) {
    super(
      `Pool not found for assets ${assetA} and ${assetB}`,
      'POOL_NOT_FOUND'
    );
    this.name = 'PoolNotFoundError';
  }
}

/**
 * Error when slippage exceeds tolerance
 */
export class SlippageExceededError extends FrySwapError {
  constructor(expected: bigint, actual: bigint) {
    super(
      `Slippage exceeded: expected ${expected}, got ${actual}`,
      'SLIPPAGE_EXCEEDED'
    );
    this.name = 'SlippageExceededError';
  }
}

/**
 * Error when pool has insufficient liquidity
 */
export class InsufficientLiquidityError extends FrySwapError {
  constructor() {
    super('Insufficient liquidity in pool', 'INSUFFICIENT_LIQUIDITY');
    this.name = 'InsufficientLiquidityError';
  }
}

/**
 * Error when transaction fails
 */
export class TransactionError extends FrySwapError {
  constructor(
    message: string,
    public txId?: string
  ) {
    super(message, 'TRANSACTION_FAILED');
    this.name = 'TransactionError';
  }
}

/**
 * Error for invalid parameters
 */
export class InvalidParamsError extends FrySwapError {
  constructor(message: string) {
    super(message, 'INVALID_PARAMS');
    this.name = 'InvalidParamsError';
  }
}
