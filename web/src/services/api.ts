/**
 * FrySwap API Client
 */

import { API_BASE_URL } from '../config/network';

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
  reserveA: string;
  reserveB: string;
  totalLpSupply: string;
  lpTokenId: number;
}

export interface PoolStats {
  tvlUsd: number;
  volume24h: number;
  volume7d: number;
  fees24h: number;
  apr: number;
}

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  fee: string;
  route: number[];
  poolIds: number[];
}

class FrySwapAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Health
  async getHealth() {
    return this.request<{ status: string; timestamp: string }>('/health');
  }

  // Pools
  async getPools(): Promise<{ pools: Pool[]; count: number }> {
    return this.request('/pools');
  }

  async getPool(appId: number): Promise<{ pool: Pool; stats: PoolStats }> {
    return this.request(`/pools/${appId}`);
  }

  async getPoolByPair(assetA: number, assetB: number): Promise<{ pool: Pool }> {
    return this.request(`/pools/pair/${assetA}/${assetB}`);
  }

  // Swap
  async getSwapQuote(params: {
    assetIn: number;
    assetOut: number;
    amountIn?: string;
    amountOut?: string;
    slippageBps?: number;
  }): Promise<{ quote: SwapQuote }> {
    const query = new URLSearchParams();
    query.set('assetIn', params.assetIn.toString());
    query.set('assetOut', params.assetOut.toString());
    if (params.amountIn) query.set('amountIn', params.amountIn);
    if (params.amountOut) query.set('amountOut', params.amountOut);
    if (params.slippageBps) query.set('slippageBps', params.slippageBps.toString());

    return this.request(`/swap/quote?${query.toString()}`);
  }

  async findRoute(assetIn: number, assetOut: number, amountIn: string): Promise<{ route: SwapQuote }> {
    const query = new URLSearchParams({
      assetIn: assetIn.toString(),
      assetOut: assetOut.toString(),
      amountIn,
    });
    return this.request(`/swap/route?${query.toString()}`);
  }

  // Prices
  async getPrices(): Promise<{ prices: Record<number, { priceInAlgo: string; pools: number[] }> }> {
    return this.request('/prices');
  }

  async getPrice(assetId: number): Promise<{ assetId: number; price: { algo: string; usd: string } }> {
    return this.request(`/prices/${assetId}`);
  }

  async getExchangeRate(assetA: number, assetB: number): Promise<{
    assetIn: number;
    assetOut: number;
    rate: string;
    inverseRate: string;
  }> {
    return this.request(`/prices/pair/${assetA}/${assetB}`);
  }
}

export const api = new FrySwapAPI();
export default api;
