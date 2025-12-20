import { getApplicationState, getAssetInfo } from './algorand.js';
import { config } from '../config.js';

export interface Pool {
  appId: number;
  assetA: {
    id: number;
    name: string;
    symbol: string;
    decimals: number;
  };
  assetB: {
    id: number;
    name: string;
    symbol: string;
    decimals: number;
  };
  reserveA: bigint;
  reserveB: bigint;
  totalLpSupply: bigint;
  lpTokenId: number;
}

export interface PoolStats {
  tvlUsd: number;
  volume24h: number;
  volume7d: number;
  fees24h: number;
  apr: number;
}

// In-memory cache for pools (replace with Redis in production)
const poolCache = new Map<number, { pool: Pool; timestamp: number }>();

/**
 * Get all registered pools
 */
export async function getAllPools(): Promise<Pool[]> {
  // In production, query the factory contract and indexer
  // For now, return mock data structure
  return [];
}

/**
 * Get pool by application ID
 */
export async function getPoolById(appId: number): Promise<Pool | null> {
  // Check cache
  const cached = poolCache.get(appId);
  if (cached && Date.now() - cached.timestamp < config.cacheTtl * 1000) {
    return cached.pool;
  }

  try {
    const state = await getApplicationState(appId);

    const assetAId = state['asset_a'] as number;
    const assetBId = state['asset_b'] as number;

    const [assetAInfo, assetBInfo] = await Promise.all([
      getAssetInfo(assetAId),
      getAssetInfo(assetBId),
    ]);

    const pool: Pool = {
      appId,
      assetA: {
        id: assetAId,
        name: assetAInfo.params.name || 'Unknown',
        symbol: assetAInfo.params['unit-name'] || 'UNK',
        decimals: assetAInfo.params.decimals || 0,
      },
      assetB: {
        id: assetBId,
        name: assetBInfo.params.name || 'Unknown',
        symbol: assetBInfo.params['unit-name'] || 'UNK',
        decimals: assetBInfo.params.decimals || 0,
      },
      reserveA: BigInt(state['reserve_a'] || 0),
      reserveB: BigInt(state['reserve_b'] || 0),
      totalLpSupply: BigInt(state['total_lp'] || 0),
      lpTokenId: state['lp_token'] as number,
    };

    // Update cache
    poolCache.set(appId, { pool, timestamp: Date.now() });

    return pool;
  } catch (error) {
    console.error(`Failed to get pool ${appId}:`, error);
    return null;
  }
}

/**
 * Get pool by asset pair
 */
export async function getPoolByAssets(
  assetA: number,
  assetB: number
): Promise<Pool | null> {
  // In production, query the factory contract
  // Factory stores pool ID keyed by sorted asset pair

  // Ensure consistent ordering
  const [sortedA, sortedB] = assetA < assetB ? [assetA, assetB] : [assetB, assetA];

  // Would call factory.get_pool(sortedA, sortedB)
  return null;
}

/**
 * Calculate pool statistics
 */
export async function getPoolStats(appId: number): Promise<PoolStats | null> {
  // In production, aggregate from indexer
  return {
    tvlUsd: 0,
    volume24h: 0,
    volume7d: 0,
    fees24h: 0,
    apr: 0,
  };
}
