import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  // Algorand configuration (using Nodely endpoints)
  algorandNetwork: process.env.ALGORAND_NETWORK || 'testnet',
  algodServer: process.env.ALGOD_SERVER || 'https://testnet-api.4160.nodely.dev',
  algodPort: parseInt(process.env.ALGOD_PORT || '443', 10),
  algodToken: process.env.ALGOD_TOKEN || '',

  indexerServer: process.env.INDEXER_SERVER || 'https://testnet-idx.4160.nodely.dev',
  indexerPort: parseInt(process.env.INDEXER_PORT || '443', 10),
  indexerToken: process.env.INDEXER_TOKEN || '',

  // Contract IDs (set after deployment)
  factoryAppId: parseInt(process.env.FACTORY_APP_ID || '0', 10),
  routerAppId: parseInt(process.env.ROUTER_APP_ID || '0', 10),

  // CORS
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],

  // Cache TTL in seconds
  cacheTtl: parseInt(process.env.CACHE_TTL || '10', 10),
} as const;

export type Config = typeof config;
