import { Router } from 'express';
import { getAllPools, getPoolByAssets } from '../services/pools.js';
import { ApiError } from '../middleware/error.js';

export const priceRouter = Router();

/**
 * GET /prices
 * Get prices for all assets
 */
priceRouter.get('/', async (req, res, next) => {
  try {
    const pools = await getAllPools();

    // Calculate prices from pool reserves
    const prices: Record<number, { priceInAlgo: string; pools: number[] }> = {};

    for (const pool of pools) {
      // For each pool, calculate relative price
      if (pool.reserveA > 0n && pool.reserveB > 0n) {
        const priceAInB = Number(pool.reserveB) / Number(pool.reserveA);
        const priceBInA = Number(pool.reserveA) / Number(pool.reserveB);

        // Store prices (simplified - production would track vs stablecoins/ALGO)
        if (!prices[pool.assetA.id]) {
          prices[pool.assetA.id] = { priceInAlgo: '0', pools: [] };
        }
        if (!prices[pool.assetB.id]) {
          prices[pool.assetB.id] = { priceInAlgo: '0', pools: [] };
        }

        prices[pool.assetA.id].pools.push(pool.appId);
        prices[pool.assetB.id].pools.push(pool.appId);
      }
    }

    res.json({ prices });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /prices/:assetId
 * Get price for a specific asset
 */
priceRouter.get('/:assetId', async (req, res, next) => {
  try {
    const assetId = parseInt(req.params.assetId, 10);
    if (isNaN(assetId)) {
      throw new ApiError(400, 'Invalid asset ID', 'INVALID_ID');
    }

    // In production, aggregate prices from multiple pools
    // and use oracle data for USD pricing

    res.json({
      assetId,
      price: {
        algo: '0',
        usd: '0',
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /prices/pair/:assetA/:assetB
 * Get exchange rate between two assets
 */
priceRouter.get('/pair/:assetA/:assetB', async (req, res, next) => {
  try {
    const assetA = parseInt(req.params.assetA, 10);
    const assetB = parseInt(req.params.assetB, 10);

    if (isNaN(assetA) || isNaN(assetB)) {
      throw new ApiError(400, 'Invalid asset IDs', 'INVALID_ASSETS');
    }

    const pool = await getPoolByAssets(assetA, assetB);
    if (!pool) {
      throw new ApiError(404, 'No pool for asset pair', 'POOL_NOT_FOUND');
    }

    // Calculate exchange rate
    const isAToB = assetA === pool.assetA.id;
    const reserveIn = isAToB ? pool.reserveA : pool.reserveB;
    const reserveOut = isAToB ? pool.reserveB : pool.reserveA;

    const rate = reserveIn > 0n ? Number(reserveOut) / Number(reserveIn) : 0;

    res.json({
      assetIn: assetA,
      assetOut: assetB,
      rate: rate.toString(),
      inverseRate: rate > 0 ? (1 / rate).toString() : '0',
      poolId: pool.appId,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});
