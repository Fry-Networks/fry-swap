import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWallet } from '@txnlab/use-wallet-react';
import TokenInput from '../components/TokenInput';
import { PlusIcon } from '../components/Icons';

interface Token {
  id: number;
  symbol: string;
  name: string;
  decimals: number;
}

const ALGO: Token = {
  id: 0,
  symbol: 'ALGO',
  name: 'Algorand',
  decimals: 6,
};

export default function AddLiquidityPage() {
  const [searchParams] = useSearchParams();
  const { activeAccount } = useWallet();
  const [tokenA, setTokenA] = useState<Token>(ALGO);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');

  const handleAddLiquidity = async () => {
    if (!activeAccount || !tokenA || !tokenB) return;
    // TODO: Implement add liquidity
    console.log('Adding liquidity...', { tokenA, tokenB, amountA, amountB });
  };

  const isValid = tokenA && tokenB && amountA && amountB &&
    parseFloat(amountA) > 0 && parseFloat(amountB) > 0;

  // Calculate share of pool (mock)
  const shareOfPool = isValid ? 0.5 : 0;

  return (
    <div className="max-w-lg mx-auto">
      {/* Back Link */}
      <Link
        to="/pools"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6"
      >
        ← Back to Pools
      </Link>

      <div className="card">
        {/* Header */}
        <h1 className="text-2xl font-bold mb-6">
          <span className="bg-fry-gradient bg-clip-text text-transparent">Add</span> Liquidity
        </h1>

        {/* Token A Input */}
        <TokenInput
          label="Token A"
          token={tokenA}
          amount={amountA}
          onAmountChange={setAmountA}
          onTokenSelect={() => {/* TODO */}}
        />

        {/* Plus Icon */}
        <div className="flex justify-center my-4">
          <div className="p-2 bg-surface-lighter rounded-xl">
            <PlusIcon className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Token B Input */}
        <TokenInput
          label="Token B"
          token={tokenB}
          amount={amountB}
          onAmountChange={setAmountB}
          onTokenSelect={() => {/* TODO */}}
        />

        {/* Pool Info */}
        {isValid && (
          <div className="mt-6 p-4 bg-surface-light rounded-xl">
            <h3 className="font-medium mb-3">Position Summary</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">{tokenA?.symbol} Deposited</span>
                <span>{amountA}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{tokenB?.symbol} Deposited</span>
                <span>{amountB}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Share of Pool</span>
                <span className="text-primary-500">{(shareOfPool * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Fee Info */}
        <div className="mt-4 p-3 bg-surface-light/50 rounded-xl text-sm text-gray-400">
          <p>
            By adding liquidity you'll earn 0.30% of all trades on this pair
            proportional to your share of the pool.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={handleAddLiquidity}
          disabled={!activeAccount || !isValid}
          className="btn-primary w-full mt-6 py-4 text-lg"
        >
          {!activeAccount
            ? 'Connect Wallet'
            : !tokenB
            ? 'Select tokens'
            : !isValid
            ? 'Enter amounts'
            : 'Add Liquidity'}
        </button>
      </div>

      {/* Info Card */}
      <div className="mt-6 p-4 bg-surface-light/30 rounded-xl border border-surface-lighter">
        <h3 className="font-medium text-primary-500 mb-2">First time providing liquidity?</h3>
        <p className="text-sm text-gray-400">
          When you add liquidity, you receive pool tokens representing your position.
          These tokens automatically earn fees proportional to your share of the pool.
        </p>
      </div>
    </div>
  );
}
