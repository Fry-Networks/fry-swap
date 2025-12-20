import SwapCard from '../components/SwapCard';
import Logo from '../components/Logo';

export default function SwapPage() {
  return (
    <div className="max-w-lg mx-auto">
      {/* Hero */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Logo className="w-20 h-20" showNetwork />
        </div>
        <h1 className="text-3xl font-bold mb-2">
          <span className="bg-fry-gradient bg-clip-text text-transparent">Swap</span> Tokens
        </h1>
        <p className="text-gray-400">
          Trade tokens instantly with minimal fees on Algorand
        </p>
      </div>

      {/* Swap Interface */}
      <SwapCard />

      {/* Info Cards */}
      <div className="grid grid-cols-3 gap-4 mt-8">
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-primary-500">0.30%</p>
          <p className="text-xs text-gray-400 mt-1">Swap Fee</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-primary-500">~3s</p>
          <p className="text-xs text-gray-400 mt-1">Finality</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-primary-500">&lt;$0.01</p>
          <p className="text-xs text-gray-400 mt-1">Gas Cost</p>
        </div>
      </div>
    </div>
  );
}
