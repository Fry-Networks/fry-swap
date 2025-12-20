import { Router } from 'express';
import { z } from 'zod';
import { getAllPools, getPoolById, getPoolByAssets, getPoolStats } from '../services/pools.js';
import { ApiError } from '../middleware/error.js';

export const poolsRouter = Router();

/**
 * GET /pools
 * List all pools
 */
poolsRouter.get('/', async (req, res, next) => {
  try {
    const pools = await getAllPools();

    res.json({
      pools: pools.map((pool) => ({
        appId: pool.appId,
        assetA: pool.assetA,
        assetB: pool.assetB,
        reserveA: pool.reserveA.toString(),
        reserveB: pool.reserveB.toString(),
        totalLpSupply: pool.totalLpSupply.toString(),
        lpTokenId: pool.lpTokenId,
      })),
      count: pools.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /pools/:appId
 * Get pool by application ID
 */
poolsRouter.get('/:appId', async (req, res, next) => {
  try {
    const appId = parseInt(req.params.appId, 10);
    if (isNaN(appId)) {
      throw new ApiError(400, 'Invalid pool ID', 'INVALID_ID');
    }

    const pool = await getPoolById(appId);
    if (!pool) {
      throw new ApiError(404, 'Pool not found', 'POOL_NOT_FOUND');
    }

    const stats = await getPoolStats(appId);

    res.json({
      pool: {
        appId: pool.appId,
        assetA: pool.assetA,
        assetB: pool.assetB,
        reserveA: pool.reserveA.toString(),
        reserveB: pool.reserveB.toString(),
        totalLpSupply: pool.totalLpSupply.toString(),
        lpTokenId: pool.lpTokenId,
      },
      stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /pools/pair/:assetA/:assetB
 * Get pool by asset pair
 */
poolsRouter.get('/pair/:assetA/:assetB', async (req, res, next) => {
  try {
    const assetA = parseInt(req.params.assetA, 10);
    const assetB = parseInt(req.params.assetB, 10);

    if (isNaN(assetA) || isNaN(assetB)) {
      throw new ApiError(400, 'Invalid asset IDs', 'INVALID_ASSETS');
    }

    const pool = await getPoolByAssets(assetA, assetB);
    if (!pool) {
      throw new ApiError(404, 'Pool not found for asset pair', 'POOL_NOT_FOUND');
    }

    res.json({
      pool: {
        appId: pool.appId,
        assetA: pool.assetA,
        assetB: pool.assetB,
        reserveA: pool.reserveA.toString(),
        reserveB: pool.reserveB.toString(),
        totalLpSupply: pool.totalLpSupply.toString(),
        lpTokenId: pool.lpTokenId,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /pools/:appId/stats
 * Get pool statistics
 */
poolsRouter.get('/:appId/stats', async (req, res, next) => {
  try {
    const appId = parseInt(req.params.appId, 10);
    if (isNaN(appId)) {
      throw new ApiError(400, 'Invalid pool ID', 'INVALID_ID');
    }

    const stats = await getPoolStats(appId);
    if (!stats) {
      throw new ApiError(404, 'Pool stats not found', 'STATS_NOT_FOUND');
    }

    res.json({ stats });
  } catch (error) {
    next(error);
  }
});
