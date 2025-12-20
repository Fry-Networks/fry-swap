import algosdk from 'algosdk';
import { Pool } from './pool.js';
import { SigningAccount, TransactionResult } from './types.js';
import { InvalidParamsError } from './errors.js';

/**
 * Parameters for adding liquidity
 */
export interface LiquidityParams {
  /** Amount of asset A to deposit */
  amountA: bigint;
  /** Amount of asset B to deposit */
  amountB: bigint;
  /** Minimum LP tokens to receive */
  minLpTokens?: bigint;
  /** Slippage tolerance in basis points */
  slippageBps?: number;
}

/**
 * Parameters for removing liquidity
 */
export interface RemoveLiquidityParams {
  /** Amount of LP tokens to burn */
  lpAmount: bigint;
  /** Minimum asset A to receive */
  minAmountA?: bigint;
  /** Minimum asset B to receive */
  minAmountB?: bigint;
  /** Slippage tolerance in basis points */
  slippageBps?: number;
}

/**
 * Result of a liquidity operation
 */
export interface LiquidityResult extends TransactionResult {
  amountA: bigint;
  amountB: bigint;
  lpTokens: bigint;
}

/**
 * Quote for adding liquidity
 */
export interface AddLiquidityQuote {
  amountA: bigint;
  amountB: bigint;
  lpTokensOut: bigint;
  minLpTokensOut: bigint;
  shareOfPool: number;
}

/**
 * Quote for removing liquidity
 */
export interface RemoveLiquidityQuote {
  lpTokensIn: bigint;
  amountAOut: bigint;
  amountBOut: bigint;
  minAmountAOut: bigint;
  minAmountBOut: bigint;
}

/**
 * Calculate optimal amounts for adding liquidity
 */
export function calculateOptimalAmounts(
  pool: Pool,
  amountADesired: bigint,
  amountBDesired: bigint
): { amountA: bigint; amountB: bigint } {
  const reserves = pool.reserves;

  if (reserves.reserveA === 0n && reserves.reserveB === 0n) {
    // First liquidity provider
    return { amountA: amountADesired, amountB: amountBDesired };
  }

  // Calculate optimal B for given A
  const optimalB = (amountADesired * reserves.reserveB) / reserves.reserveA;

  if (optimalB <= amountBDesired) {
    return { amountA: amountADesired, amountB: optimalB };
  }

  // Calculate optimal A for given B
  const optimalA = (amountBDesired * reserves.reserveA) / reserves.reserveB;

  return { amountA: optimalA, amountB: amountBDesired };
}

/**
 * Calculate add liquidity quote
 */
export function calculateAddLiquidityQuote(
  pool: Pool,
  params: LiquidityParams
): AddLiquidityQuote {
  const { amountA, amountB, slippageBps = 50 } = params;

  const optimal = calculateOptimalAmounts(pool, amountA, amountB);
  const lpTokensOut = pool.calculateLpTokens(optimal.amountA, optimal.amountB);

  const slippageMultiplier = BigInt(10000 - slippageBps);
  const minLpTokensOut = (lpTokensOut * slippageMultiplier) / 10000n;

  // Calculate share of pool
  const newTotalSupply = pool.totalLpSupply + lpTokensOut;
  const shareOfPool = Number(lpTokensOut) / Number(newTotalSupply);

  return {
    amountA: optimal.amountA,
    amountB: optimal.amountB,
    lpTokensOut,
    minLpTokensOut,
    shareOfPool,
  };
}

/**
 * Calculate remove liquidity quote
 */
export function calculateRemoveLiquidityQuote(
  pool: Pool,
  params: RemoveLiquidityParams
): RemoveLiquidityQuote {
  const { lpAmount, slippageBps = 50 } = params;

  const { amountA, amountB } = pool.calculateRemoveLiquidity(lpAmount);

  const slippageMultiplier = BigInt(10000 - slippageBps);
  const minAmountAOut = (amountA * slippageMultiplier) / 10000n;
  const minAmountBOut = (amountB * slippageMultiplier) / 10000n;

  return {
    lpTokensIn: lpAmount,
    amountAOut: amountA,
    amountBOut: amountB,
    minAmountAOut,
    minAmountBOut,
  };
}

/**
 * Build add liquidity transactions
 */
export async function buildAddLiquidityTransactions(
  algod: algosdk.Algodv2,
  pool: Pool,
  sender: string,
  quote: AddLiquidityQuote
): Promise<algosdk.Transaction[]> {
  const params = await algod.getTransactionParams().do();
  const poolAddress = algosdk.getApplicationAddress(pool.appId);

  const transactions: algosdk.Transaction[] = [];

  // Transfer asset A
  if (pool.assetA.id === 0) {
    transactions.push(
      algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender,
        receiver: poolAddress,
        amount: quote.amountA,
        suggestedParams: params,
      })
    );
  } else {
    transactions.push(
      algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender,
        receiver: poolAddress,
        assetIndex: pool.assetA.id,
        amount: quote.amountA,
        suggestedParams: params,
      })
    );
  }

  // Transfer asset B
  if (pool.assetB.id === 0) {
    transactions.push(
      algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender,
        receiver: poolAddress,
        amount: quote.amountB,
        suggestedParams: params,
      })
    );
  } else {
    transactions.push(
      algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender,
        receiver: poolAddress,
        assetIndex: pool.assetB.id,
        amount: quote.amountB,
        suggestedParams: params,
      })
    );
  }

  // Application call
  transactions.push(
    algosdk.makeApplicationCallTxnFromObject({
      sender,
      appIndex: pool.appId,
      appArgs: [
        new TextEncoder().encode('add_liquidity'),
        algosdk.encodeUint64(quote.amountA),
        algosdk.encodeUint64(quote.amountB),
        algosdk.encodeUint64(quote.minLpTokensOut),
      ],
      foreignAssets: [pool.assetA.id, pool.assetB.id, pool.lpTokenId].filter(
        (id) => id !== 0
      ),
      suggestedParams: params,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
    })
  );

  algosdk.assignGroupID(transactions);

  return transactions;
}

/**
 * Build remove liquidity transactions
 */
export async function buildRemoveLiquidityTransactions(
  algod: algosdk.Algodv2,
  pool: Pool,
  sender: string,
  quote: RemoveLiquidityQuote
): Promise<algosdk.Transaction[]> {
  const params = await algod.getTransactionParams().do();
  const poolAddress = algosdk.getApplicationAddress(pool.appId);

  const transactions: algosdk.Transaction[] = [];

  // Transfer LP tokens
  transactions.push(
    algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender,
      receiver: poolAddress,
      assetIndex: pool.lpTokenId,
      amount: quote.lpTokensIn,
      suggestedParams: params,
    })
  );

  // Application call
  transactions.push(
    algosdk.makeApplicationCallTxnFromObject({
      sender,
      appIndex: pool.appId,
      appArgs: [
        new TextEncoder().encode('remove_liquidity'),
        algosdk.encodeUint64(quote.lpTokensIn),
        algosdk.encodeUint64(quote.minAmountAOut),
        algosdk.encodeUint64(quote.minAmountBOut),
      ],
      foreignAssets: [pool.assetA.id, pool.assetB.id, pool.lpTokenId].filter(
        (id) => id !== 0
      ),
      suggestedParams: params,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
    })
  );

  algosdk.assignGroupID(transactions);

  return transactions;
}

/**
 * Execute add liquidity
 */
export async function executeAddLiquidity(
  algod: algosdk.Algodv2,
  pool: Pool,
  account: SigningAccount,
  params: LiquidityParams
): Promise<LiquidityResult> {
  const quote = calculateAddLiquidityQuote(pool, params);
  const transactions = await buildAddLiquidityTransactions(
    algod,
    pool,
    account.addr,
    quote
  );

  const signedTxns = await account.signer(
    transactions,
    transactions.map((_, i) => i)
  );

  const { txid } = await algod.sendRawTransaction(signedTxns).do();
  const result = await algosdk.waitForConfirmation(algod, txid, 4);

  return {
    txId: txid,
    confirmedRound: result['confirmed-round'],
    amountA: quote.amountA,
    amountB: quote.amountB,
    lpTokens: quote.lpTokensOut,
  };
}

/**
 * Execute remove liquidity
 */
export async function executeRemoveLiquidity(
  algod: algosdk.Algodv2,
  pool: Pool,
  account: SigningAccount,
  params: RemoveLiquidityParams
): Promise<LiquidityResult> {
  const quote = calculateRemoveLiquidityQuote(pool, params);
  const transactions = await buildRemoveLiquidityTransactions(
    algod,
    pool,
    account.addr,
    quote
  );

  const signedTxns = await account.signer(
    transactions,
    transactions.map((_, i) => i)
  );

  const { txid } = await algod.sendRawTransaction(signedTxns).do();
  const result = await algosdk.waitForConfirmation(algod, txid, 4);

  return {
    txId: txid,
    confirmedRound: result['confirmed-round'],
    amountA: quote.amountAOut,
    amountB: quote.amountBOut,
    lpTokens: quote.lpTokensIn,
  };
}
