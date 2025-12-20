import { Pool, getPoolByAssets } from './pools.js';
import { ApiError } from '../middleware/error.js';

// Fee constants (must match smart contract)
const SWAP_FEE_BPS = 30; // 0.30%

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  priceImpact: number;
  fee: bigint;
  route: number[]; // Asset IDs in order
  poolIds: number[]; // Pool app IDs used
}

export interface SwapParams {
  assetIn: number;
  assetOut: number;
  amountIn?: bigint;
  amountOut?: bigint;
  slippageBps?: number;
}

/**
 * Calculate output amount for a swap using constant product formula
 */
export function calculateSwapOutput(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): bigint {
  if (reserveIn === 0n || reserveOut === 0n) {
    throw new ApiError(400, 'Pool has no liquidity', 'NO_LIQUIDITY');
  }

  const feeMultiplier = BigInt(10000 - SWAP_FEE_BPS);
  const amountInWithFee = amountIn * feeMultiplier;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;

  return numerator / denominator;
}

/**
 * Calculate input amount needed for exact output
 */
export function calculateSwapInput(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): bigint {
  if (reserveIn === 0n || reserveOut === 0n || amountOut >= reserveOut) {
    throw new ApiError(400, 'Invalid swap parameters', 'INVALID_PARAMS');
  }

  const feeMultiplier = BigInt(10000 - SWAP_FEE_BPS);
  const numerator = reserveIn * amountOut * 10000n;
  const denominator = (reserveOut - amountOut) * feeMultiplier;

  return numerator / denominator + 1n; // Round up
}

/**
 * Calculate price impact for a swap
 */
export function calculatePriceImpact(
  amountIn: bigint,
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): number {
  const spotPrice = Number(reserveOut) / Number(reserveIn);
  const executionPrice = Number(amountOut) / Number(amountIn);
  return Math.abs((spotPrice - executionPrice) / spotPrice);
}

/**
 * Get a quote for a swap
 */
export async function getSwapQuote(params: SwapParams): Promise<SwapQuote> {
  const { assetIn, assetOut, amountIn, amountOut, slippageBps = 50 } = params;

  if (!amountIn && !amountOut) {
    throw new ApiError(400, 'Must specify amountIn or amountOut', 'MISSING_AMOUNT');
  }

  // Find pool for this pair
  const pool = await getPoolByAssets(assetIn, assetOut);
  if (!pool) {
    throw new ApiError(404, 'No pool found for asset pair', 'POOL_NOT_FOUND');
  }

  // Determine which way we're swapping
  const isAToB = assetIn === pool.assetA.id;
  const reserveIn = isAToB ? pool.reserveA : pool.reserveB;
  const reserveOut = isAToB ? pool.reserveB : pool.reserveA;

  let finalAmountIn: bigint;
  let finalAmountOut: bigint;

  if (amountIn) {
    finalAmountIn = amountIn;
    finalAmountOut = calculateSwapOutput(amountIn, reserveIn, reserveOut);
  } else {
    finalAmountOut = amountOut!;
    finalAmountIn = calculateSwapInput(amountOut!, reserveIn, reserveOut);
  }

  const fee = (finalAmountIn * BigInt(SWAP_FEE_BPS)) / 10000n;
  const priceImpact = calculatePriceImpact(
    finalAmountIn,
    finalAmountOut,
    reserveIn,
    reserveOut
  );

  return {
    amountIn: finalAmountIn,
    amountOut: finalAmountOut,
    priceImpact,
    fee,
    route: [assetIn, assetOut],
    poolIds: [pool.appId],
  };
}

/**
 * Find the best route for a multi-hop swap
 */
export async function findBestRoute(
  assetIn: number,
  assetOut: number,
  amountIn: bigint
): Promise<SwapQuote | null> {
  // Check direct route first
  const directPool = await getPoolByAssets(assetIn, assetOut);
  if (directPool) {
    return getSwapQuote({ assetIn, assetOut, amountIn });
  }

  // In production, implement multi-hop routing through intermediate assets
  // Common intermediates: ALGO, USDC, etc.
  return null;
}
