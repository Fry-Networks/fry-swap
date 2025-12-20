import { Router } from 'express';
import { z } from 'zod';
import { getSwapQuote, findBestRoute } from '../services/swap.js';
import { ApiError } from '../middleware/error.js';

export const swapRouter = Router();

const quoteSchema = z.object({
  assetIn: z.number().int().positive(),
  assetOut: z.number().int().positive(),
  amountIn: z.string().optional(),
  amountOut: z.string().optional(),
  slippageBps: z.number().int().min(0).max(10000).optional(),
});

/**
 * GET /swap/quote
 * Get a quote for swapping tokens
 */
swapRouter.get('/quote', async (req, res, next) => {
  try {
    const parsed = quoteSchema.safeParse({
      assetIn: req.query.assetIn ? parseInt(req.query.assetIn as string, 10) : undefined,
      assetOut: req.query.assetOut ? parseInt(req.query.assetOut as string, 10) : undefined,
      amountIn: req.query.amountIn as string | undefined,
      amountOut: req.query.amountOut as string | undefined,
      slippageBps: req.query.slippageBps
        ? parseInt(req.query.slippageBps as string, 10)
        : undefined,
    });

    if (!parsed.success) {
      throw new ApiError(400, 'Invalid query parameters', 'INVALID_PARAMS');
    }

    const { assetIn, assetOut, amountIn, amountOut, slippageBps } = parsed.data;

    const quote = await getSwapQuote({
      assetIn,
      assetOut,
      amountIn: amountIn ? BigInt(amountIn) : undefined,
      amountOut: amountOut ? BigInt(amountOut) : undefined,
      slippageBps,
    });

    res.json({
      quote: {
        amountIn: quote.amountIn.toString(),
        amountOut: quote.amountOut.toString(),
        priceImpact: quote.priceImpact,
        fee: quote.fee.toString(),
        route: quote.route,
        poolIds: quote.poolIds,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /swap/quote
 * Get a quote for swapping tokens (POST method for complex queries)
 */
swapRouter.post('/quote', async (req, res, next) => {
  try {
    const parsed = quoteSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, 'Invalid request body', 'INVALID_PARAMS');
    }

    const { assetIn, assetOut, amountIn, amountOut, slippageBps } = parsed.data;

    const quote = await getSwapQuote({
      assetIn,
      assetOut,
      amountIn: amountIn ? BigInt(amountIn) : undefined,
      amountOut: amountOut ? BigInt(amountOut) : undefined,
      slippageBps,
    });

    res.json({
      quote: {
        amountIn: quote.amountIn.toString(),
        amountOut: quote.amountOut.toString(),
        priceImpact: quote.priceImpact,
        fee: quote.fee.toString(),
        route: quote.route,
        poolIds: quote.poolIds,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /swap/route
 * Find the best route for a swap (including multi-hop)
 */
swapRouter.get('/route', async (req, res, next) => {
  try {
    const assetIn = parseInt(req.query.assetIn as string, 10);
    const assetOut = parseInt(req.query.assetOut as string, 10);
    const amountIn = req.query.amountIn as string;

    if (isNaN(assetIn) || isNaN(assetOut) || !amountIn) {
      throw new ApiError(400, 'Missing required parameters', 'MISSING_PARAMS');
    }

    const route = await findBestRoute(assetIn, assetOut, BigInt(amountIn));

    if (!route) {
      throw new ApiError(404, 'No route found', 'NO_ROUTE');
    }

    res.json({
      route: {
        amountIn: route.amountIn.toString(),
        amountOut: route.amountOut.toString(),
        priceImpact: route.priceImpact,
        fee: route.fee.toString(),
        path: route.route,
        poolIds: route.poolIds,
      },
    });
  } catch (error) {
    next(error);
  }
});
