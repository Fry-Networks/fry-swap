import { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import { useSwapStore } from '../store/swap';
import { formatTokenAmount, parseTokenAmount, FRY, FRY_FEE_ADDRESS } from '../config/tokens';
import {
  getAssetBalance,
  getSuggestedParams,
  algodClient,
  isOptedIntoAsset,
  waitForConfirmation
} from '../services/algorand';
import { EXPLORER_TX_URL } from '../config/network';
import TokenSelector from './TokenSelector';
import TokenInput from './TokenInput';
import { ArrowDownIcon, SettingsIcon } from './Icons';

export default function SwapCard() {
  const { activeAccount, signTransactions } = useWallet();
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
  const [fryBalance, setFryBalance] = useState<bigint>(0n);
  const [swapping, setSwapping] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  // Fetch balances when account or tokens change
  useEffect(() => {
    if (!activeAccount) {
      setBalanceIn('');
      setBalanceOut('');
      setFryBalance(0n);
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

        // Fetch FRY balance for fee payment
        const fryBal = await getAssetBalance(activeAccount.address, FRY.id);
        setFryBalance(fryBal);
      } catch (err) {
        console.error('Failed to fetch balances:', err);
      }
    };

    fetchBalances();
  }, [activeAccount, tokenIn, tokenOut]);

  const handleSwap = async () => {
    if (!activeAccount || !quote || !tokenOut) return;

    setSwapping(true);
    setSwapError(null);
    setTxId(null);
    clearError();

    try {
      const suggestedParams = await getSuggestedParams();
      const sender = activeAccount.address;
      const transactions: algosdk.Transaction[] = [];

      // Calculate amounts in base units
      const amountInBase = parseTokenAmount(amountIn, tokenIn.decimals);
      const fryFeeAmount = BigInt(quote.fryFee.amount);

      // Check if user needs to opt-in to output token
      if (tokenOut.id !== 0) {
        const isOptedIn = await isOptedIntoAsset(sender, tokenOut.id);
        if (!isOptedIn) {
          // Build opt-in transaction for output token
          const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            from: sender,
            to: sender,
            assetIndex: tokenOut.id,
            amount: 0,
            suggestedParams,
          });
          transactions.push(optInTxn);
        }
      }

      // Transaction 1: Send input asset to pool (simulated as self-transfer for demo)
      // In production, this would go to the actual pool address from quote.poolIds[0]
      if (tokenIn.id === 0) {
        // ALGO payment
        const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          from: sender,
          to: sender, // In production: pool address
          amount: amountInBase,
          suggestedParams,
          note: new Uint8Array(Buffer.from('FrySwap: Swap input')),
        });
        transactions.push(paymentTxn);
      } else {
        // ASA transfer
        const assetTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          from: sender,
          to: sender, // In production: pool address
          assetIndex: tokenIn.id,
          amount: amountInBase,
          suggestedParams,
          note: new Uint8Array(Buffer.from('FrySwap: Swap input')),
        });
        transactions.push(assetTxn);
      }

      // Transaction 2: FRY fee payment
      const fryFeeTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: sender,
        to: FRY_FEE_ADDRESS,
        assetIndex: FRY.id,
        amount: fryFeeAmount,
        suggestedParams,
        note: new Uint8Array(Buffer.from('FrySwap: Platform fee')),
      });
      transactions.push(fryFeeTxn);

      // Assign group ID if multiple transactions
      if (transactions.length > 1) {
        algosdk.assignGroupID(transactions);
      }

      // Encode transactions for signing
      const encodedTxns = transactions.map(txn => txn.toByte());

      // Sign transactions with wallet
      const signedTxnsResult = await signTransactions(encodedTxns);

      // Filter out null values from signed transactions
      const signedTxns = signedTxnsResult.filter((txn): txn is Uint8Array => txn !== null);

      // Submit to network
      const { txId: submittedTxId } = await algodClient.sendRawTransaction(signedTxns).do();

      // Wait for confirmation
      await waitForConfirmation(submittedTxId);

      setTxId(submittedTxId);

      // Refresh balances after successful swap
      const balIn = await getAssetBalance(sender, tokenIn.id);
      setBalanceIn(formatTokenAmount(balIn, tokenIn.decimals));
      if (tokenOut) {
        const balOut = await getAssetBalance(sender, tokenOut.id);
        setBalanceOut(formatTokenAmount(balOut, tokenOut.decimals));
      }
      const fryBal = await getAssetBalance(sender, FRY.id);
      setFryBalance(fryBal);

      // Clear amounts
      setAmountIn('');

    } catch (err) {
      console.error('Swap failed:', err);
      setSwapError(err instanceof Error ? err.message : 'Swap failed. Please try again.');
    } finally {
      setSwapping(false);
    }
  };

  const isValidSwap = tokenIn && tokenOut && amountIn && parseFloat(amountIn) > 0 && quote;
  const priceImpactWarning = quote && quote.priceImpact > 0.05; // > 5%

  // Check if user has enough FRY for the fee
  const fryFeeAmount = quote?.fryFee ? BigInt(quote.fryFee.amount) : 0n;
  const hasSufficientFry = fryBalance >= fryFeeAmount;
  const fryBalanceFormatted = formatTokenAmount(fryBalance, FRY.decimals);

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

        {/* Success Message */}
        {txId && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
            <div className="flex items-center justify-between">
              <span>Swap successful!</span>
              <a
                href={EXPLORER_TX_URL(txId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-300 hover:text-green-200 underline"
              >
                View transaction
              </a>
            </div>
          </div>
        )}

        {/* Swap Error */}
        {swapError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {swapError}
          </div>
        )}

        {/* Quote Error */}
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
            {/* FRY Fee */}
            <div className="flex justify-between items-center border-t border-surface-lighter pt-2 mt-2">
              <span className="text-gray-400">Platform Fee (FRY)</span>
              <div className="text-right">
                <span className={!hasSufficientFry ? 'text-red-400' : 'text-primary-400'}>
                  {quote.fryFee.amountFormatted} FRY
                </span>
                {quote.fryFee.usdValue > 0 && (
                  <span className="text-gray-500 text-xs ml-1">
                    (~${quote.fryFee.usdValue.toFixed(4)})
                  </span>
                )}
              </div>
            </div>
            {activeAccount && (
              <div className="flex justify-between text-gray-500 text-xs">
                <span>Your FRY Balance</span>
                <span className={!hasSufficientFry ? 'text-red-400' : ''}>
                  {fryBalanceFormatted} FRY
                </span>
              </div>
            )}
          </div>
        )}

        {/* Insufficient FRY Warning */}
        {quote && activeAccount && !hasSufficientFry && (
          <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm">
            Insufficient FRY balance for platform fee. You need {quote.fryFee.amountFormatted} FRY but have {fryBalanceFormatted} FRY.
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
          disabled={!activeAccount || !isValidSwap || swapping || !hasSufficientFry}
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
          ) : !hasSufficientFry && quote ? (
            'Insufficient FRY for fee'
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
