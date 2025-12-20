import algosdk from 'algosdk';
import { Asset, PoolState, Reserves } from './types.js';
import { InsufficientLiquidityError } from './errors.js';

// Fee in basis points (0.30%)
const SWAP_FEE_BPS = 30;

/**
 * Pool information
 */
export interface PoolInfo {
  appId: number;
  assetA: Asset;
  assetB: Asset;
  reserves: Reserves;
  totalLpSupply: bigint;
  lpTokenId: number;
}

/**
 * Represents an AMM pool
 */
export class Pool {
  constructor(
    public readonly appId: number,
    public readonly assetA: Asset,
    public readonly assetB: Asset,
    private _reserveA: bigint,
    private _reserveB: bigint,
    public readonly lpTokenId: number,
    private _totalLpSupply: bigint
  ) {}

  /**
   * Get current reserves
   */
  get reserves(): Reserves {
    return {
      reserveA: this._reserveA,
      reserveB: this._reserveB,
    };
  }

  /**
   * Get total LP token supply
   */
  get totalLpSupply(): bigint {
    return this._totalLpSupply;
  }

  /**
   * Check if pool has liquidity
   */
  get hasLiquidity(): boolean {
    return this._reserveA > 0n && this._reserveB > 0n;
  }

  /**
   * Get the spot price of asset A in terms of asset B
   */
  getSpotPrice(assetId: number): number {
    if (!this.hasLiquidity) {
      return 0;
    }

    if (assetId === this.assetA.id) {
      return Number(this._reserveB) / Number(this._reserveA);
    } else {
      return Number(this._reserveA) / Number(this._reserveB);
    }
  }

  /**
   * Calculate output amount for a swap
   */
  calculateSwapOutput(amountIn: bigint, assetInId: number): bigint {
    if (!this.hasLiquidity) {
      throw new InsufficientLiquidityError();
    }

    const isAToB = assetInId === this.assetA.id;
    const reserveIn = isAToB ? this._reserveA : this._reserveB;
    const reserveOut = isAToB ? this._reserveB : this._reserveA;

    const feeMultiplier = BigInt(10000 - SWAP_FEE_BPS);
    const amountInWithFee = amountIn * feeMultiplier;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 10000n + amountInWithFee;

    return numerator / denominator;
  }

  /**
   * Calculate input amount for exact output
   */
  calculateSwapInput(amountOut: bigint, assetOutId: number): bigint {
    if (!this.hasLiquidity) {
      throw new InsufficientLiquidityError();
    }

    const isAToB = assetOutId === this.assetB.id;
    const reserveIn = isAToB ? this._reserveA : this._reserveB;
    const reserveOut = isAToB ? this._reserveB : this._reserveA;

    if (amountOut >= reserveOut) {
      throw new InsufficientLiquidityError();
    }

    const feeMultiplier = BigInt(10000 - SWAP_FEE_BPS);
    const numerator = reserveIn * amountOut * 10000n;
    const denominator = (reserveOut - amountOut) * feeMultiplier;

    return numerator / denominator + 1n;
  }

  /**
   * Calculate price impact for a swap
   */
  calculatePriceImpact(amountIn: bigint, assetInId: number): number {
    const amountOut = this.calculateSwapOutput(amountIn, assetInId);
    const spotPrice = this.getSpotPrice(assetInId);
    const executionPrice = Number(amountOut) / Number(amountIn);

    return Math.abs((spotPrice - executionPrice) / spotPrice);
  }

  /**
   * Calculate LP tokens for adding liquidity
   */
  calculateLpTokens(amountA: bigint, amountB: bigint): bigint {
    if (this._totalLpSupply === 0n) {
      // Initial liquidity
      const product = amountA * amountB;
      // Integer square root approximation
      let z = (product + 1n) / 2n;
      let y = product;
      while (z < y) {
        y = z;
        z = (product / z + z) / 2n;
      }
      return y - 1000n; // Subtract minimum liquidity
    }

    // Proportional liquidity
    const lpFromA = (amountA * this._totalLpSupply) / this._reserveA;
    const lpFromB = (amountB * this._totalLpSupply) / this._reserveB;

    return lpFromA < lpFromB ? lpFromA : lpFromB;
  }

  /**
   * Calculate amounts for removing liquidity
   */
  calculateRemoveLiquidity(lpAmount: bigint): { amountA: bigint; amountB: bigint } {
    const amountA = (lpAmount * this._reserveA) / this._totalLpSupply;
    const amountB = (lpAmount * this._reserveB) / this._totalLpSupply;

    return { amountA, amountB };
  }

  /**
   * Update pool state (called after fetching new data)
   */
  updateState(reserveA: bigint, reserveB: bigint, totalLpSupply: bigint): void {
    this._reserveA = reserveA;
    this._reserveB = reserveB;
    this._totalLpSupply = totalLpSupply;
  }

  /**
   * Get pool info as plain object
   */
  toInfo(): PoolInfo {
    return {
      appId: this.appId,
      assetA: this.assetA,
      assetB: this.assetB,
      reserves: this.reserves,
      totalLpSupply: this._totalLpSupply,
      lpTokenId: this.lpTokenId,
    };
  }
}
