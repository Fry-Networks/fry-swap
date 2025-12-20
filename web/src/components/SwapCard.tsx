import { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { useSwapStore } from '../store/swap';
import { formatTokenAmount } from '../config/tokens';
import { getAssetBalance } from '../services/algorand';
import TokenSelector from './TokenSelector';
import TokenInput from './TokenInput';
import { ArrowDownIcon, SettingsIcon } from './Icons';

export default function SwapCard() {
  const { activeAccount, signTransactions, sendTransactions } = useWallet();
  const {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    slippageBps,
    quote,
    loading,
    error,
    setTokenIn,
    setTokenOut,
    setAmountIn,
    setSlippage,
    swapTokens,
    clearError,
  } = useSwapStore();

  const [showSettings, setShowSettings] = useState(false);
  const [selectingToken, setSelectingToken] = useState<'in' | 'out' | null>(null);
  const [balanceIn, setBalanceIn] = useState<string>('');
  const [balanceOut, setBalanceOut] = useState<string>('');
  const [swapping, setSwapping] = useState(false);

  // Fetch balances when account or tokens change
  useEffect(() => {
    if (!activeAccount) {
      setBalanceIn('');
      setBalanceOut('');
      return;
    }

    const fetchBalances = async () => {
      try {
        const balIn = await getAssetBalance(activeAccount.address, tokenIn.id);
        setBalanceIn(formatTokenAmount(balIn, tokenIn.decimals));

        if (tokenOut) {
          const balOut = await getAssetBalance(activeAccount.address, tokenOut.id);
          setBalanceOut(formatTokenAmount(balOut, tokenOut.decimals));
        }
      } catch (err) {
        console.error('Failed to fetch balances:', err);
      }
    };

    fetchBalances();
  }, [activeAccount, tokenIn, tokenOut]);

  const handleSwap = async () => {
    if (!activeAccount || !quote || !tokenOut) return;

    setSwapping(true);
    clearError();

    try {
      // TODO: Build and submit swap transactions
      // This would use the SDK to build the atomic transaction group
      console.log('Executing swap...', {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        quote,
      });

      // Placeholder for actual swap execution
      alert('Swap functionality will execute through the smart contracts once deployed!');
    } catch (err) {
      console.error('Swap failed:', err);
    } finally {
      setSwapping(false);
    }
  };

  const isValidSwap = tokenIn && tokenOut && amountIn && parseFloat(amountIn) > 0 && quote;
  const priceImpactWarning = quote && quote.priceImpact > 0.05; // > 5%

  return (
    <>
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
                {[10, 50, 100].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSlippage(value)}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      slippageBps === value
                        ? 'bg-primary-500 text-white'
                        : 'bg-surface-lighter text-gray-400 hover:text-white'
                    }`}
                  >
                    {value / 100}%
                  </button>
                ))}
                <div className="flex items-center bg-surface-lighter rounded-lg">
                  <input
                    type="number"
                    value={slippageBps / 100}
                    onChange={(e) => setSlippage(Math.round(parseFloat(e.target.value) * 100) || 0)}
                    className="w-16 px-2 py-1 bg-transparent rounded-lg text-sm text-right outline-none"
                    step="0.1"
                    min="0"
                    max="50"
                  />
                  <span className="pr-2 text-sm text-gray-400">%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Token In */}
        <TokenInput
          label="You pay"
          token={tokenIn}
          amount={amountIn}
          onAmountChange={setAmountIn}
          onTokenSelect={() => setSelectingToken('in')}
          balance={balanceIn}
        />

        {/* Swap Direction Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={swapTokens}
            className="p-2 bg-surface-lighter rounded-xl border-4 border-surface hover:bg-surface-light hover:rotate-180 transition-all duration-200"
          >
            <ArrowDownIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Token Out */}
        <TokenInput
          label="You receive"
          token={tokenOut}
          amount={amountOut}
          onAmountChange={() => {}}
          onTokenSelect={() => setSelectingToken('out')}
          balance={balanceOut}
          readonly
          loading={loading}
        />

        {/* Price Info */}
        {quote && tokenIn && tokenOut && (
          <div className="mt-4 p-3 bg-surface-light rounded-xl text-sm space-y-2">
            <div className="flex justify-between text-gray-400">
              <span>Rate</span>
              <span>
                1 {tokenIn.symbol} ={' '}
                {(parseFloat(amountOut) / parseFloat(amountIn)).toFixed(6)} {tokenOut.symbol}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Price Impact</span>
              <span className={priceImpactWarning ? 'text-red-400' : 'text-green-400'}>
                {(quote.priceImpact * 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Minimum received</span>
              <span>
                {(parseFloat(amountOut) * (1 - slippageBps / 10000)).toFixed(6)} {tokenOut.symbol}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Network Fee</span>
              <span>~0.002 ALGO</span>
            </div>
          </div>
        )}

        {/* Price Impact Warning */}
        {priceImpactWarning && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            High price impact! You may receive significantly less tokens.
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={!activeAccount || !isValidSwap || swapping}
          className="btn-primary w-full mt-6 py-4 text-lg disabled:opacity-50"
        >
          {swapping ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Swapping...
            </span>
          ) : !activeAccount ? (
            'Connect Wallet'
          ) : !tokenOut ? (
            'Select a token'
          ) : !amountIn || parseFloat(amountIn) <= 0 ? (
            'Enter an amount'
          ) : loading ? (
            'Fetching quote...'
          ) : (
            'Swap'
          )}
        </button>
      </div>

      {/* Token Selector Modal */}
      <TokenSelector
        isOpen={selectingToken !== null}
        onClose={() => setSelectingToken(null)}
        onSelect={(token) => {
          if (selectingToken === 'in') {
            setTokenIn(token);
          } else {
            setTokenOut(token);
          }
        }}
        selectedToken={selectingToken === 'in' ? tokenIn : tokenOut}
        disabledToken={selectingToken === 'in' ? tokenOut : tokenIn}
      />
    </>
  );
}
