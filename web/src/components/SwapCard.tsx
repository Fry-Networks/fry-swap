import { useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import TokenInput from './TokenInput';
import { ArrowDownIcon, SettingsIcon } from './Icons';

interface Token {
  id: number;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
}

const ALGO: Token = {
  id: 0,
  symbol: 'ALGO',
  name: 'Algorand',
  decimals: 6,
};

export default function SwapCard() {
  const { activeAccount } = useWallet();
  const [tokenIn, setTokenIn] = useState<Token>(ALGO);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);

  const handleSwapTokens = () => {
    const tempToken = tokenIn;
    const tempAmount = amountIn;
    setTokenIn(tokenOut || ALGO);
    setTokenOut(tempToken);
    setAmountIn(amountOut);
    setAmountOut(tempAmount);
  };

  const handleSwap = async () => {
    if (!activeAccount) return;
    // TODO: Implement swap logic
    console.log('Swapping...', { tokenIn, tokenOut, amountIn, amountOut });
  };

  const isValidSwap = tokenIn && tokenOut && amountIn && parseFloat(amountIn) > 0;

  return (
    <div className="card max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Swap</h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-lg hover:bg-surface-lighter transition-colors"
        >
          <SettingsIcon className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-4 bg-surface-light rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Slippage Tolerance</span>
            <div className="flex items-center gap-2">
              {[0.1, 0.5, 1.0].map((value) => (
                <button
                  key={value}
                  onClick={() => setSlippage(value)}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    slippage === value
                      ? 'bg-primary-500 text-white'
                      : 'bg-surface-lighter text-gray-400 hover:text-white'
                  }`}
                >
                  {value}%
                </button>
              ))}
              <input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
                className="w-16 px-2 py-1 bg-surface-lighter rounded-lg text-sm text-right"
                step="0.1"
                min="0"
                max="50"
              />
            </div>
          </div>
        </div>
      )}

      {/* Token In */}
      <TokenInput
        label="You pay"
        token={tokenIn}
        amount={amountIn}
        onAmountChange={setAmountIn}
        onTokenSelect={() => {/* TODO: Open token selector */}}
      />

      {/* Swap Direction Button */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          onClick={handleSwapTokens}
          className="p-2 bg-surface-lighter rounded-xl border-4 border-surface hover:bg-surface-light transition-colors"
        >
          <ArrowDownIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Token Out */}
      <TokenInput
        label="You receive"
        token={tokenOut}
        amount={amountOut}
        onAmountChange={setAmountOut}
        onTokenSelect={() => {/* TODO: Open token selector */}}
        readonly
      />

      {/* Price Info */}
      {tokenIn && tokenOut && amountIn && amountOut && (
        <div className="mt-4 p-3 bg-surface-light rounded-xl text-sm">
          <div className="flex justify-between text-gray-400">
            <span>Rate</span>
            <span>
              1 {tokenIn.symbol} = {(parseFloat(amountOut) / parseFloat(amountIn)).toFixed(4)} {tokenOut.symbol}
            </span>
          </div>
          <div className="flex justify-between text-gray-400 mt-1">
            <span>Price Impact</span>
            <span className="text-green-400">&lt; 0.01%</span>
          </div>
          <div className="flex justify-between text-gray-400 mt-1">
            <span>Minimum received</span>
            <span>{(parseFloat(amountOut) * (1 - slippage / 100)).toFixed(4)} {tokenOut.symbol}</span>
          </div>
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={!activeAccount || !isValidSwap}
        className="btn-primary w-full mt-6 py-4 text-lg"
      >
        {!activeAccount
          ? 'Connect Wallet'
          : !isValidSwap
          ? 'Enter an amount'
          : 'Swap'}
      </button>
    </div>
  );
}
