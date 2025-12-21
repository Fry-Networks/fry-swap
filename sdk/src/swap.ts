import algosdk from 'algosdk';
import { Pool } from './pool.js';
import { SigningAccount, TransactionResult } from './types.js';
import { InvalidParamsError, SlippageExceededError } from './errors.js';

// FRY Token Configuration
export const FRY_TOKEN_ID = 2485314946;
export const FRY_FEE_ADDRESS = 'E2F2LT2INE75DBOYHQXTCTOP2PAP5MHAXQRXTTCCXFKHQTVG36DJONBQZE';

/**
 * FRY fee information for a swap
 */
export interface FryFeeInfo {
  /** Amount of FRY to pay as fee */
  amount: bigint;
  /** Human-readable FRY amount */
  amountFormatted: string;
  /** Address to send FRY fee to */
  feeAddress: string;
  /** FRY ASA ID */
  fryTokenId: number;
  /** USD value of the fee */
  usdValue: number;
}

/**
 * Parameters for a swap
 */
export interface SwapParams {
  /** Asset to sell */
  assetIn: number;
  /** Asset to buy */
  assetOut: number;
  /** Exact amount to sell (use this OR amountOut) */
  amountIn?: bigint;
  /** Exact amount to buy (use this OR amountIn) */
  amountOut?: bigint;
  /** Slippage tolerance in basis points (default: 50 = 0.5%) */
  slippageBps?: number;
  /** Transaction deadline (Unix timestamp) */
  deadline?: number;
  /** FRY fee info (from API quote) */
  fryFee?: FryFeeInfo;
}

/**
 * Quote for a swap
 */
export interface SwapQuote {
  /** Amount of input asset */
  amountIn: bigint;
  /** Amount of output asset */
  amountOut: bigint;
  /** Minimum output (after slippage) */
  minAmountOut: bigint;
  /** Maximum input (after slippage, for exact output swaps) */
  maxAmountIn: bigint;
  /** Price impact as decimal (0.01 = 1%) */
  priceImpact: number;
  /** Fee amount in input asset */
  fee: bigint;
  /** Route (asset IDs) */
  route: number[];
  /** Pool IDs used */
  poolIds: number[];
  /** FRY fee information */
  fryFee?: FryFeeInfo;
}

/**
 * Result of a swap transaction
 */
export interface SwapResult extends TransactionResult {
  amountIn: bigint;
  amountOut: bigint;
}

const SWAP_FEE_BPS = 30;

/**
 * Calculate a swap quote
 */
export function calculateSwapQuote(
  pool: Pool,
  params: SwapParams
): SwapQuote {
  const { assetIn, assetOut, amountIn, amountOut, slippageBps = 50 } = params;

  if (!amountIn && !amountOut) {
    throw new InvalidParamsError('Must specify amountIn or amountOut');
  }

  if (amountIn && amountOut) {
    throw new InvalidParamsError('Cannot specify both amountIn and amountOut');
  }

  let finalAmountIn: bigint;
  let finalAmountOut: bigint;

  if (amountIn) {
    finalAmountIn = amountIn;
    finalAmountOut = pool.calculateSwapOutput(amountIn, assetIn);
  } else {
    finalAmountOut = amountOut!;
    finalAmountIn = pool.calculateSwapInput(amountOut!, assetOut);
  }

  const priceImpact = pool.calculatePriceImpact(finalAmountIn, assetIn);
  const fee = (finalAmountIn * BigInt(SWAP_FEE_BPS)) / 10000n;

  // Calculate slippage bounds
  const slippageMultiplier = BigInt(10000 - slippageBps);
  const minAmountOut = (finalAmountOut * slippageMultiplier) / 10000n;
  const maxAmountIn = (finalAmountIn * BigInt(10000 + slippageBps)) / 10000n;

  return {
    amountIn: finalAmountIn,
    amountOut: finalAmountOut,
    minAmountOut,
    maxAmountIn,
    priceImpact,
    fee,
    route: [assetIn, assetOut],
    poolIds: [pool.appId],
  };
}

/**
 * Build swap transactions
 * Includes FRY fee payment transaction if fryFee is provided
 */
export async function buildSwapTransactions(
  algod: algosdk.Algodv2,
  pool: Pool,
  sender: string,
  quote: SwapQuote,
  deadline?: number
): Promise<algosdk.Transaction[]> {
  const params = await algod.getTransactionParams().do();

  // Set transaction validity window
  if (deadline) {
    // Deadline is handled in the contract
  }

  const transactions: algosdk.Transaction[] = [];

  // 1. FRY fee payment (if required)
  if (quote.fryFee && quote.fryFee.amount > 0n) {
    transactions.push(
      algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender,
        receiver: quote.fryFee.feeAddress,
        assetIndex: quote.fryFee.fryTokenId,
        amount: quote.fryFee.amount,
        suggestedParams: params,
        note: new TextEncoder().encode('FrySwap Platform Fee'),
      })
    );
  }

  // 2. Asset transfer to pool (payment for swap)
  const assetInId = quote.route[0];
  if (assetInId === 0) {
    // ALGO transfer
    transactions.push(
      algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender,
        receiver: algosdk.getApplicationAddress(pool.appId),
        amount: quote.amountIn,
        suggestedParams: params,
      })
    );
  } else {
    // ASA transfer
    transactions.push(
      algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender,
        receiver: algosdk.getApplicationAddress(pool.appId),
        assetIndex: assetInId,
        amount: quote.amountIn,
        suggestedParams: params,
      })
    );
  }

  // 3. Application call to execute swap
  const foreignAssets = [quote.route[0], quote.route[1]].filter((id) => id !== 0);
  // Include FRY token in foreign assets if needed
  if (quote.fryFee && !foreignAssets.includes(quote.fryFee.fryTokenId)) {
    foreignAssets.push(quote.fryFee.fryTokenId);
  }

  transactions.push(
    algosdk.makeApplicationCallTxnFromObject({
      sender,
      appIndex: pool.appId,
      appArgs: [
        new TextEncoder().encode('swap'),
        algosdk.encodeUint64(quote.amountIn),
        algosdk.encodeUint64(quote.minAmountOut),
      ],
      foreignAssets,
      suggestedParams: params,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
    })
  );

  // Assign group ID
  algosdk.assignGroupID(transactions);

  return transactions;
}

/**
 * Execute a swap
 */
export async function executeSwap(
  algod: algosdk.Algodv2,
  pool: Pool,
  account: SigningAccount,
  params: SwapParams
): Promise<SwapResult> {
  const quote = calculateSwapQuote(pool, params);
  const transactions = await buildSwapTransactions(
    algod,
    pool,
    account.addr,
    quote,
    params.deadline
  );

  // Sign transactions
  const signedTxns = await account.signer(
    transactions,
    transactions.map((_, i) => i)
  );

  // Submit transaction group
  const { txid } = await algod.sendRawTransaction(signedTxns).do();

  // Wait for confirmation
  const result = await algosdk.waitForConfirmation(algod, txid, 4);

  return {
    txId: txid,
    confirmedRound: result['confirmed-round'],
    amountIn: quote.amountIn,
    amountOut: quote.amountOut,
  };
}
