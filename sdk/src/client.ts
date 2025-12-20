import algosdk from 'algosdk';
import { FrySwapConfig, TESTNET_CONFIG } from './config.js';
import { Pool, PoolInfo } from './pool.js';
import { SwapParams, SwapQuote, SwapResult, calculateSwapQuote, executeSwap } from './swap.js';
import {
  LiquidityParams,
  RemoveLiquidityParams,
  LiquidityResult,
  executeAddLiquidity,
  executeRemoveLiquidity,
  calculateAddLiquidityQuote,
  calculateRemoveLiquidityQuote,
  AddLiquidityQuote,
  RemoveLiquidityQuote,
} from './liquidity.js';
import { Asset, SigningAccount, PoolState } from './types.js';
import { PoolNotFoundError, FrySwapError } from './errors.js';

/**
 * Main FrySwap client
 */
export class FrySwap {
  private algod: algosdk.Algodv2;
  private indexer: algosdk.Indexer;
  private poolCache: Map<string, Pool> = new Map();

  constructor(private config: FrySwapConfig = TESTNET_CONFIG) {
    this.algod = new algosdk.Algodv2(
      config.network.algodToken,
      config.network.algodServer,
      config.network.algodPort
    );

    this.indexer = new algosdk.Indexer(
      config.network.indexerToken,
      config.network.indexerServer,
      config.network.indexerPort
    );
  }

  /**
   * Get the Algod client
   */
  get algodClient(): algosdk.Algodv2 {
    return this.algod;
  }

  /**
   * Get the Indexer client
   */
  get indexerClient(): algosdk.Indexer {
    return this.indexer;
  }

  /**
   * Get pool by application ID
   */
  async getPool(appId: number): Promise<Pool> {
    const cacheKey = `app:${appId}`;
    const cached = this.poolCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const appInfo = await this.algod.getApplicationByID(appId).do();
      const state = this.parseApplicationState(appInfo.params['global-state'] || []);

      const assetAId = state['asset_a'] as number;
      const assetBId = state['asset_b'] as number;

      const [assetAInfo, assetBInfo] = await Promise.all([
        this.getAssetInfo(assetAId),
        this.getAssetInfo(assetBId),
      ]);

      const pool = new Pool(
        appId,
        assetAInfo,
        assetBInfo,
        BigInt(state['reserve_a'] || 0),
        BigInt(state['reserve_b'] || 0),
        state['lp_token'] as number,
        BigInt(state['total_lp'] || 0)
      );

      this.poolCache.set(cacheKey, pool);
      return pool;
    } catch (error) {
      throw new FrySwapError(`Failed to fetch pool ${appId}`, 'POOL_FETCH_ERROR');
    }
  }

  /**
   * Get pool by asset pair
   */
  async getPoolByAssets(assetA: number, assetB: number): Promise<Pool> {
    // Ensure consistent ordering
    const [sortedA, sortedB] = assetA < assetB ? [assetA, assetB] : [assetB, assetA];
    const cacheKey = `pair:${sortedA}:${sortedB}`;

    const cached = this.poolCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Query factory contract for pool ID
    // This would use the factory's get_pool method
    // For now, throw not found
    throw new PoolNotFoundError(assetA, assetB);
  }

  /**
   * Get all pools
   */
  async getAllPools(): Promise<PoolInfo[]> {
    // Query factory for all registered pools
    // This would iterate through factory storage
    return [];
  }

  /**
   * Refresh pool state
   */
  async refreshPool(pool: Pool): Promise<void> {
    const appInfo = await this.algod.getApplicationByID(pool.appId).do();
    const state = this.parseApplicationState(appInfo.params['global-state'] || []);

    pool.updateState(
      BigInt(state['reserve_a'] || 0),
      BigInt(state['reserve_b'] || 0),
      BigInt(state['total_lp'] || 0)
    );
  }

  /**
   * Get a swap quote
   */
  async getSwapQuote(params: SwapParams): Promise<SwapQuote> {
    const pool = await this.getPoolByAssets(params.assetIn, params.assetOut);
    return calculateSwapQuote(pool, params);
  }

  /**
   * Execute a swap
   */
  async swap(account: SigningAccount, params: SwapParams): Promise<SwapResult> {
    const pool = await this.getPoolByAssets(params.assetIn, params.assetOut);
    return executeSwap(this.algod, pool, account, params);
  }

  /**
   * Get quote for adding liquidity
   */
  async getAddLiquidityQuote(
    assetA: number,
    assetB: number,
    params: LiquidityParams
  ): Promise<AddLiquidityQuote> {
    const pool = await this.getPoolByAssets(assetA, assetB);
    return calculateAddLiquidityQuote(pool, params);
  }

  /**
   * Add liquidity to a pool
   */
  async addLiquidity(
    account: SigningAccount,
    assetA: number,
    assetB: number,
    params: LiquidityParams
  ): Promise<LiquidityResult> {
    const pool = await this.getPoolByAssets(assetA, assetB);
    return executeAddLiquidity(this.algod, pool, account, params);
  }

  /**
   * Get quote for removing liquidity
   */
  async getRemoveLiquidityQuote(
    assetA: number,
    assetB: number,
    params: RemoveLiquidityParams
  ): Promise<RemoveLiquidityQuote> {
    const pool = await this.getPoolByAssets(assetA, assetB);
    return calculateRemoveLiquidityQuote(pool, params);
  }

  /**
   * Remove liquidity from a pool
   */
  async removeLiquidity(
    account: SigningAccount,
    assetA: number,
    assetB: number,
    params: RemoveLiquidityParams
  ): Promise<LiquidityResult> {
    const pool = await this.getPoolByAssets(assetA, assetB);
    return executeRemoveLiquidity(this.algod, pool, account, params);
  }

  /**
   * Get asset information
   */
  private async getAssetInfo(assetId: number): Promise<Asset> {
    if (assetId === 0) {
      return {
        id: 0,
        name: 'Algorand',
        symbol: 'ALGO',
        decimals: 6,
      };
    }

    const assetInfo = await this.algod.getAssetByID(assetId).do();
    return {
      id: assetId,
      name: assetInfo.params.name || 'Unknown',
      symbol: assetInfo.params['unit-name'] || 'UNK',
      decimals: assetInfo.params.decimals || 0,
    };
  }

  /**
   * Parse application state from raw format
   */
  private parseApplicationState(state: any[]): Record<string, any> {
    const parsed: Record<string, any> = {};

    for (const item of state) {
      const key = Buffer.from(item.key, 'base64').toString();
      const value = item.value;

      if (value.type === 1) {
        parsed[key] = Buffer.from(value.bytes, 'base64');
      } else {
        parsed[key] = value.uint;
      }
    }

    return parsed;
  }

  /**
   * Clear the pool cache
   */
  clearCache(): void {
    this.poolCache.clear();
  }
}
