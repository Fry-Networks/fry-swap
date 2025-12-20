/**
 * Network configuration
 */
export interface NetworkConfig {
  algodServer: string;
  algodPort: number;
  algodToken: string;
  indexerServer: string;
  indexerPort: number;
  indexerToken: string;
}

/**
 * FrySwap configuration
 */
export interface FrySwapConfig {
  network: NetworkConfig;
  factoryAppId: number;
  routerAppId: number;
}

/**
 * Mainnet configuration (using Nodely endpoints)
 */
export const MAINNET_CONFIG: FrySwapConfig = {
  network: {
    algodServer: 'https://mainnet-api.4160.nodely.dev',
    algodPort: 443,
    algodToken: '',
    indexerServer: 'https://mainnet-idx.4160.nodely.dev',
    indexerPort: 443,
    indexerToken: '',
  },
  factoryAppId: 0, // Set after deployment
  routerAppId: 0, // Set after deployment
};

/**
 * Testnet configuration (using Nodely endpoints)
 */
export const TESTNET_CONFIG: FrySwapConfig = {
  network: {
    algodServer: 'https://testnet-api.4160.nodely.dev',
    algodPort: 443,
    algodToken: '',
    indexerServer: 'https://testnet-idx.4160.nodely.dev',
    indexerPort: 443,
    indexerToken: '',
  },
  factoryAppId: 0, // Set after deployment
  routerAppId: 0, // Set after deployment
};

/**
 * Create custom configuration
 */
export function createConfig(
  partial: Partial<FrySwapConfig> & { network: NetworkConfig }
): FrySwapConfig {
  return {
    factoryAppId: 0,
    routerAppId: 0,
    ...partial,
  };
}

/**
 * Default configuration (mainnet)
 */
export const DEFAULT_CONFIG = MAINNET_CONFIG;
