/**
 * Network configuration for FrySwap
 * Default: Algorand Mainnet via Nodely
 */

export const NETWORK_CONFIG = {
  network: 'mainnet' as const,
  algodServer: 'https://mainnet-api.4160.nodely.dev',
  algodPort: 443,
  algodToken: '',
  indexerServer: 'https://mainnet-idx.4160.nodely.dev',
  indexerPort: 443,
  indexerToken: '',
};

// API endpoints
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Explorer URLs
export const EXPLORER_URL = 'https://explorer.perawallet.app';
export const EXPLORER_TX_URL = (txId: string) => `${EXPLORER_URL}/tx/${txId}`;
export const EXPLORER_ASSET_URL = (assetId: number) => `${EXPLORER_URL}/asset/${assetId}`;
export const EXPLORER_ADDRESS_URL = (address: string) => `${EXPLORER_URL}/address/${address}`;
export const EXPLORER_APP_URL = (appId: number) => `${EXPLORER_URL}/application/${appId}`;

// Algorand constants
export const ALGO_DECIMALS = 6;
export const MIN_BALANCE = 100_000; // 0.1 ALGO minimum balance
export const MIN_TXN_FEE = 1_000; // 0.001 ALGO
