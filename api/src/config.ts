import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  // FRY Token Fee Configuration
  fryTokenId: 2485314946, // FRY token ASA ID
  fryFeeAddress: 'E2F2LT2INE75DBOYHQXTCTOP2PAP5MHAXQRXTTCCXFKHQTVG36DJONBQZE', // Fee recipient address
  fryFeeBps: parseInt(process.env.FRY_FEE_BPS || '30', 10), // Fee in basis points (0.30% default)

  // Algorand configuration (using Nodely mainnet endpoints)
  algorandNetwork: process.env.ALGORAND_NETWORK || 'mainnet',
  algodServer: process.env.ALGOD_SERVER || 'https://mainnet-api.4160.nodely.dev',
  algodPort: parseInt(process.env.ALGOD_PORT || '443', 10),
  algodToken: process.env.ALGOD_TOKEN || '',

  indexerServer: process.env.INDEXER_SERVER || 'https://mainnet-idx.4160.nodely.dev',
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
