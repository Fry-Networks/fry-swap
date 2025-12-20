import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PoolCard from '../components/PoolCard';
import { PlusIcon } from '../components/Icons';

interface Pool {
  appId: number;
  assetA: { id: number; symbol: string; name: string };
  assetB: { id: number; symbol: string; name: string };
  reserveA: string;
  reserveB: string;
  tvl: number;
  apr: number;
  volume24h: number;
}

// Mock data for demonstration
const MOCK_POOLS: Pool[] = [
  {
    appId: 123456,
    assetA: { id: 0, symbol: 'ALGO', name: 'Algorand' },
    assetB: { id: 31566704, symbol: 'USDC', name: 'USD Coin' },
    reserveA: '1000000',
    reserveB: '250000',
    tvl: 500000,
    apr: 12.5,
    volume24h: 75000,
  },
  {
    appId: 123457,
    assetA: { id: 0, symbol: 'ALGO', name: 'Algorand' },
    assetB: { id: 312769, symbol: 'USDT', name: 'Tether' },
    reserveA: '500000',
    reserveB: '125000',
    tvl: 250000,
    apr: 8.2,
    volume24h: 32000,
  },
];

export default function PoolsPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // TODO: Fetch pools from API
    const fetchPools = async () => {
      try {
        // const response = await fetch('/api/v1/pools');
        // const data = await response.json();
        // setPools(data.pools);
        setPools(MOCK_POOLS);
      } catch (error) {
        console.error('Failed to fetch pools:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPools();
  }, []);

  const filteredPools = pools.filter((pool) => {
    const query = searchQuery.toLowerCase();
    return (
      pool.assetA.symbol.toLowerCase().includes(query) ||
      pool.assetB.symbol.toLowerCase().includes(query) ||
      pool.assetA.name.toLowerCase().includes(query) ||
      pool.assetB.name.toLowerCase().includes(query)
    );
  });

  const totalTvl = pools.reduce((sum, pool) => sum + pool.tvl, 0);
  const totalVolume = pools.reduce((sum, pool) => sum + pool.volume24h, 0);

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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-sm text-gray-400">Total Value Locked</p>
          <p className="text-2xl font-bold mt-1">
            ${(totalTvl / 1_000_000).toFixed(2)}M
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-400">24h Volume</p>
          <p className="text-2xl font-bold mt-1">
            ${(totalVolume / 1_000).toFixed(0)}K
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-400">Total Pools</p>
          <p className="text-2xl font-bold mt-1">{pools.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-400">Avg APR</p>
          <p className="text-2xl font-bold mt-1 text-green-400">
            {pools.length > 0
              ? (pools.reduce((sum, p) => sum + p.apr, 0) / pools.length).toFixed(1)
              : 0}
            %
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
              <div className="h-12 bg-surface-lighter rounded mb-4" />
              <div className="h-20 bg-surface-lighter rounded" />
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
            <PoolCard key={pool.appId} pool={pool} />
          ))}
        </div>
      )}
    </div>
  );
}
