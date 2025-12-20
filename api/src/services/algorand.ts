import algosdk from 'algosdk';
import { config } from '../config.js';

// Algod client for sending transactions
export const algodClient = new algosdk.Algodv2(
  config.algodToken,
  config.algodServer,
  config.algodPort
);

// Indexer client for querying historical data
export const indexerClient = new algosdk.Indexer(
  config.indexerToken,
  config.indexerServer,
  config.indexerPort
);

/**
 * Get current network parameters
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
 * Get asset information
 */
export async function getAssetInfo(assetId: number) {
  return algodClient.getAssetByID(assetId).do();
}

/**
 * Get application state
 */
export async function getApplicationState(appId: number) {
  const appInfo = await algodClient.getApplicationByID(appId).do();
  return parseApplicationState(appInfo.params['global-state'] || []);
}

/**
 * Parse application state from raw format
 */
function parseApplicationState(state: any[]): Record<string, any> {
  const parsed: Record<string, any> = {};

  for (const item of state) {
    const key = Buffer.from(item.key, 'base64').toString();
    const value = item.value;

    if (value.type === 1) {
      // Bytes
      parsed[key] = Buffer.from(value.bytes, 'base64');
    } else {
      // Uint64
      parsed[key] = value.uint;
    }
  }

  return parsed;
}

/**
 * Call a read-only application method
 */
export async function simulateAppCall(
  appId: number,
  method: string,
  args: any[]
): Promise<any> {
  // In production, use ABI to encode method calls
  // This is a placeholder for the simulation logic
  const params = await getSuggestedParams();

  // Would use algosdk.AtomicTransactionComposer for proper ABI calls
  return null;
}
