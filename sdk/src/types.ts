import algosdk from 'algosdk';

/**
 * Asset information
 */
export interface Asset {
  id: number;
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Pool reserves
 */
export interface Reserves {
  reserveA: bigint;
  reserveB: bigint;
}

/**
 * Transaction result
 */
export interface TransactionResult {
  txId: string;
  confirmedRound: number;
}

/**
 * Signer function type
 */
export type TransactionSigner = (
  txnGroup: algosdk.Transaction[],
  indexesToSign: number[]
) => Promise<Uint8Array[]>;

/**
 * Account that can sign transactions
 */
export interface SigningAccount {
  addr: string;
  signer: TransactionSigner;
}

/**
 * Pool state from on-chain
 */
export interface PoolState {
  assetA: number;
  assetB: number;
  reserveA: bigint;
  reserveB: bigint;
  totalLpSupply: bigint;
  lpTokenId: number;
  paused: boolean;
}
