/**
 * Algorand blockchain service
 */

import algosdk from 'algosdk';
import { NETWORK_CONFIG, MIN_TXN_FEE } from '../config/network';

// Initialize Algod client
export const algodClient = new algosdk.Algodv2(
  NETWORK_CONFIG.algodToken,
  NETWORK_CONFIG.algodServer,
  NETWORK_CONFIG.algodPort
);

// Initialize Indexer client
export const indexerClient = new algosdk.Indexer(
  NETWORK_CONFIG.indexerToken,
  NETWORK_CONFIG.indexerServer,
  NETWORK_CONFIG.indexerPort
);

/**
 * Get suggested transaction parameters
 */
export async function getSuggestedParams(): Promise<algosdk.SuggestedParams> {
  return algodClient.getTransactionParams().do();
}

/**
 * Get account information
 */
export async function getAccountInfo(address: string) {
  return algodClient.accountInformation(address).do();
}

/**
 * Get account balance
 */
export async function getAccountBalance(address: string): Promise<bigint> {
  const info = await getAccountInfo(address);
  return BigInt(info.amount);
}

/**
 * Get asset balance for an account
 */
export async function getAssetBalance(address: string, assetId: number): Promise<bigint> {
  if (assetId === 0) {
    return getAccountBalance(address);
  }

  const info = await getAccountInfo(address);
  const asset = info.assets?.find((a: any) => a['asset-id'] === assetId);
  return asset ? BigInt(asset.amount) : 0n;
}

/**
 * Get asset information
 */
export async function getAssetInfo(assetId: number) {
  if (assetId === 0) {
    return {
      index: 0,
      params: {
        name: 'Algorand',
        'unit-name': 'ALGO',
        decimals: 6,
        total: 10_000_000_000_000_000n,
      },
    };
  }
  return algodClient.getAssetByID(assetId).do();
}

/**
 * Check if account is opted into an asset
 */
export async function isOptedIntoAsset(address: string, assetId: number): Promise<boolean> {
  if (assetId === 0) return true; // ALGO doesn't require opt-in

  const info = await getAccountInfo(address);
  return info.assets?.some((a: any) => a['asset-id'] === assetId) ?? false;
}

/**
 * Build opt-in transaction for an asset
 */
export async function buildOptInTxn(
  address: string,
  assetId: number
): Promise<algosdk.Transaction> {
  const params = await getSuggestedParams();

  return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    assetIndex: assetId,
    amount: 0,
    suggestedParams: params,
  });
}

/**
 * Build payment transaction (ALGO)
 */
export async function buildPaymentTxn(
  sender: string,
  receiver: string,
  amount: bigint
): Promise<algosdk.Transaction> {
  const params = await getSuggestedParams();

  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver,
    amount,
    suggestedParams: params,
  });
}

/**
 * Build asset transfer transaction
 */
export async function buildAssetTransferTxn(
  sender: string,
  receiver: string,
  assetId: number,
  amount: bigint
): Promise<algosdk.Transaction> {
  const params = await getSuggestedParams();

  if (assetId === 0) {
    return buildPaymentTxn(sender, receiver, amount);
  }

  return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender,
    receiver,
    assetIndex: assetId,
    amount,
    suggestedParams: params,
  });
}

/**
 * Wait for transaction confirmation
 */
export async function waitForConfirmation(txId: string, rounds = 4): Promise<any> {
  return algosdk.waitForConfirmation(algodClient, txId, rounds);
}

/**
 * Get application state
 */
export async function getApplicationState(appId: number): Promise<Record<string, any>> {
  const appInfo = await algodClient.getApplicationByID(appId).do();
  return parseGlobalState(appInfo.params['global-state'] || []);
}

/**
 * Parse global state from raw format
 */
function parseGlobalState(state: any[]): Record<string, any> {
  const parsed: Record<string, any> = {};

  for (const item of state) {
    const key = Buffer.from(item.key, 'base64').toString();
    const value = item.value;

    if (value.type === 1) {
      // Bytes
      parsed[key] = Buffer.from(value.bytes, 'base64');
    } else {
      // Uint64
      parsed[key] = BigInt(value.uint);
    }
  }

  return parsed;
}
