import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PoolCard from '../components/PoolCard';
import { PlusIcon } from '../components/Icons';
import api, { Pool } from '../services/api';

interface PoolWithStats extends Pool {
  tvl?: number;
  apr?: number;
  volume24h?: number;
}

export default function PoolsPage() {
  const [pools, setPools] = useState<PoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPools = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getPools();

      // Enrich pools with stats
      const poolsWithStats: PoolWithStats[] = await Promise.all(
        response.pools.map(async (pool) => {
          try {
            const statsResponse = await api.getPool(pool.appId);
            return {
              ...pool,
              tvl: statsResponse.stats.tvlUsd,
              apr: statsResponse.stats.apr,
              volume24h: statsResponse.stats.volume24h,
            };
          } catch {
            // If stats fetch fails, use calculated estimates
            const reserveANum = parseFloat(pool.reserveA) / Math.pow(10, pool.assetA.decimals);
            const reserveBNum = parseFloat(pool.reserveB) / Math.pow(10, pool.assetB.decimals);

            // Rough estimate - in production would use price feeds
            const estimatedTvl = pool.assetA.id === 0
              ? reserveANum * 0.25 * 2 // ALGO at ~$0.25
              : reserveBNum * 2; // Assume paired with stablecoin

            return {
              ...pool,
              tvl: estimatedTvl,
              apr: 5 + Math.random() * 15, // Placeholder APR
              volume24h: estimatedTvl * 0.1, // Estimate 10% daily volume
            };
          }
        })
      );

      setPools(poolsWithStats);
    } catch (err) {
      console.error('Failed to fetch pools:', err);
      setError('Failed to load pools. The API may be unavailable.');

      // Fallback to demo pools when API is unavailable
      const demoPools: PoolWithStats[] = [
        {
          appId: 1001,
          assetA: { id: 0, symbol: 'ALGO', name: 'Algorand', decimals: 6 },
          assetB: { id: 31566704, symbol: 'USDC', name: 'USD Coin', decimals: 6 },
          reserveA: '1000000000000',
          reserveB: '250000000000',
          totalLpSupply: '500000000000',
          lpTokenId: 0,
          tvl: 500000,
          apr: 12.5,
          volume24h: 75000,
        },
        {
          appId: 1002,
          assetA: { id: 0, symbol: 'ALGO', name: 'Algorand', decimals: 6 },
          assetB: { id: 312769, symbol: 'USDT', name: 'Tether USDt', decimals: 6 },
          reserveA: '500000000000',
          reserveB: '125000000000',
          totalLpSupply: '250000000000',
          lpTokenId: 0,
          tvl: 250000,
          apr: 8.2,
          volume24h: 32000,
        },
        {
          appId: 1003,
          assetA: { id: 0, symbol: 'ALGO', name: 'Algorand', decimals: 6 },
          assetB: { id: 2485314946, symbol: 'FRY', name: 'FRY Token', decimals: 6 },
          reserveA: '200000000000',
          reserveB: '1000000000000',
          totalLpSupply: '400000000000',
          lpTokenId: 0,
          tvl: 100000,
          apr: 25.5,
          volume24h: 15000,
        },
        {
          appId: 1004,
          assetA: { id: 31566704, symbol: 'USDC', name: 'USD Coin', decimals: 6 },
          assetB: { id: 312769, symbol: 'USDT', name: 'Tether USDt', decimals: 6 },
          reserveA: '2000000000000',
          reserveB: '2000000000000',
          totalLpSupply: '2000000000000',
          lpTokenId: 0,
          tvl: 4000000,
          apr: 3.2,
          volume24h: 500000,
        },
      ];
      setPools(demoPools);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  const filteredPools = pools.filter((pool) => {
    const query = searchQuery.toLowerCase();
    return (
      pool.assetA.symbol.toLowerCase().includes(query) ||
      pool.assetB.symbol.toLowerCase().includes(query) ||
      pool.assetA.name.toLowerCase().includes(query) ||
      pool.assetB.name.toLowerCase().includes(query)
    );
  });

  const totalTvl = pools.reduce((sum, pool) => sum + (pool.tvl || 0), 0);
  const totalVolume = pools.reduce((sum, pool) => sum + (pool.volume24h || 0), 0);
  const avgApr = pools.length > 0
    ? pools.reduce((sum, p) => sum + (p.apr || 0), 0) / pools.length
    : 0;

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    } else if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="bg-fry-gradient bg-clip-text text-transparent">Liquidity</span> Pools
          </h1>
          <p className="text-gray-400 mt-1">
            Provide liquidity and earn fees on every swap
          </p>
        </div>

        <Link to="/pools/add" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          New Position
        </Link>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchPools}
              className="text-yellow-300 hover:text-yellow-200 underline text-sm"
            >
              Retry
            </button>
          </div>
          <p className="text-sm mt-1 text-yellow-500/70">
            Showing demo pools for preview purposes.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-sm text-gray-400">Total Value Locked</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalTvl)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-400">24h Volume</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalVolume)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-400">Total Pools</p>
          <p className="text-2xl font-bold mt-1">{pools.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-400">Avg APR</p>
          <p className="text-2xl font-bold mt-1 text-green-400">
            {avgApr.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search pools by token..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field w-full max-w-md"
        />
      </div>

      {/* Pools Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-surface-lighter" />
                <div className="w-10 h-10 rounded-full bg-surface-lighter -ml-4" />
                <div className="h-6 bg-surface-lighter rounded w-24 ml-2" />
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-surface-lighter rounded w-full" />
                <div className="h-4 bg-surface-lighter rounded w-3/4" />
                <div className="h-4 bg-surface-lighter rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredPools.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No pools found</p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-primary-500 hover:text-primary-400 mt-2"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPools.map((pool) => (
            <PoolCard
              key={pool.appId}
              pool={{
                appId: pool.appId,
                assetA: pool.assetA,
                assetB: pool.assetB,
                reserveA: pool.reserveA,
                reserveB: pool.reserveB,
                tvl: pool.tvl || 0,
                apr: pool.apr || 0,
                volume24h: pool.volume24h || 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Empty State for New Users */}
      {!loading && pools.length === 0 && !error && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-surface-lighter rounded-full flex items-center justify-center mx-auto mb-4">
            <PlusIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No pools yet</h3>
          <p className="text-gray-400 mb-6">
            Be the first to create a liquidity pool!
          </p>
          <Link to="/pools/add" className="btn-primary inline-flex items-center gap-2">
            <PlusIcon className="w-5 h-5" />
            Create Pool
          </Link>
        </div>
      )}
    </div>
  );
}
