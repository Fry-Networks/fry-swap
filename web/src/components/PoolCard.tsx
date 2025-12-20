import { Link } from 'react-router-dom';
import { ExternalLinkIcon, PlusIcon } from './Icons';

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

interface PoolCardProps {
  pool: Pool;
}

export default function PoolCard({ pool }: PoolCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="card hover:border-primary-500/50 transition-colors">
      {/* Pool Pair */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold border-2 border-surface">
              {pool.assetA.symbol.charAt(0)}
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-700 flex items-center justify-center text-sm font-bold border-2 border-surface">
              {pool.assetB.symbol.charAt(0)}
            </div>
          </div>
          <div>
            <h3 className="font-semibold">
              {pool.assetA.symbol} / {pool.assetB.symbol}
            </h3>
            <p className="text-sm text-gray-400">0.30% fee</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/pools/add?a=${pool.assetA.id}&b=${pool.assetB.id}`}
            className="p-2 rounded-lg bg-surface-lighter hover:bg-primary-500/20 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
          </Link>
          <a
            href={`https://testnet.algoexplorer.io/application/${pool.appId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-surface-lighter hover:bg-surface-light transition-colors"
          >
            <ExternalLinkIcon className="w-5 h-5" />
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs text-gray-400 mb-1">TVL</p>
          <p className="font-semibold">{formatNumber(pool.tvl)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-400 mb-1">24h Volume</p>
          <p className="font-semibold">{formatNumber(pool.volume24h)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-400 mb-1">APR</p>
          <p className="font-semibold text-green-400">{pool.apr.toFixed(2)}%</p>
        </div>
      </div>

      {/* Reserves */}
      <div className="mt-4 pt-4 border-t border-surface-lighter">
        <p className="text-xs text-gray-400 mb-2">Reserves</p>
        <div className="flex justify-between text-sm">
          <span>{parseFloat(pool.reserveA).toLocaleString()} {pool.assetA.symbol}</span>
          <span>{parseFloat(pool.reserveB).toLocaleString()} {pool.assetB.symbol}</span>
        </div>
      </div>
    </div>
  );
}
