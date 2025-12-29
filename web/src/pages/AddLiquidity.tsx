import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import TokenInput from '../components/TokenInput';
import TokenSelector from '../components/TokenSelector';
import { PlusIcon, ExternalLinkIcon } from '../components/Icons';
import {
  Token,
  ALGO,
  MAINNET_TOKENS,
  formatTokenAmount,
  parseTokenAmount,
} from '../config/tokens';
import {
  getAssetBalance,
  getSuggestedParams,
  algodClient,
  isOptedIntoAsset,
  waitForConfirmation
} from '../services/algorand';
import { EXPLORER_TX_URL } from '../config/network';
import api from '../services/api';

export default function AddLiquidityPage() {
  const { activeAccount, signTransactions } = useWallet();

  // Token state
  const [tokenA, setTokenA] = useState<Token>(ALGO);
  const [tokenB, setTokenB] = useState<Token | null>(
    MAINNET_TOKENS.find(t => t.symbol === 'USDC') || null
  );
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');

  // Balance state
  const [balanceA, setBalanceA] = useState<string>('');
  const [balanceB, setBalanceB] = useState<string>('');

  // Modal state
  const [selectingToken, setSelectingToken] = useState<'A' | 'B' | null>(null);

  // Transaction state
  const [loading, setLoading] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pool info
  const [poolExists, setPoolExists] = useState<boolean | null>(null);
  const [poolReserves, setPoolReserves] = useState<{ reserveA: string; reserveB: string } | null>(null);

  // Fetch balances
  useEffect(() => {
    if (!activeAccount) {
      setBalanceA('');
      setBalanceB('');
      return;
    }

    const fetchBalances = async () => {
      try {
        const balA = await getAssetBalance(activeAccount.address, tokenA.id);
        setBalanceA(formatTokenAmount(balA, tokenA.decimals));

        if (tokenB) {
          const balB = await getAssetBalance(activeAccount.address, tokenB.id);
          setBalanceB(formatTokenAmount(balB, tokenB.decimals));
        }
      } catch (err) {
        console.error('Failed to fetch balances:', err);
      }
    };

    fetchBalances();
  }, [activeAccount, tokenA, tokenB]);

  // Check if pool exists and fetch reserves
  useEffect(() => {
    if (!tokenA || !tokenB) {
      setPoolExists(null);
      setPoolReserves(null);
      return;
    }

    const checkPool = async () => {
      try {
        const response = await api.getPoolByPair(tokenA.id, tokenB.id);
        setPoolExists(true);
        setPoolReserves({
          reserveA: response.pool.reserveA,
          reserveB: response.pool.reserveB
        });
      } catch {
        setPoolExists(false);
        setPoolReserves(null);
      }
    };

    checkPool();
  }, [tokenA, tokenB]);

  // Auto-calculate tokenB amount based on pool ratio
  useEffect(() => {
    if (poolReserves && amountA && parseFloat(amountA) > 0 && tokenB) {
      const reserveA = parseFloat(poolReserves.reserveA);
      const reserveB = parseFloat(poolReserves.reserveB);

      if (reserveA > 0 && reserveB > 0) {
        const amountABase = parseFloat(amountA) * Math.pow(10, tokenA.decimals);
        const amountBBase = (amountABase * reserveB) / reserveA;
        const amountBDisplay = amountBBase / Math.pow(10, tokenB.decimals);
        setAmountB(amountBDisplay.toFixed(6));
      }
    }
  }, [amountA, poolReserves, tokenA, tokenB]);

  const handleAddLiquidity = async () => {
    if (!activeAccount || !tokenA || !tokenB || !amountA || !amountB) return;

    setLoading(true);
    setError(null);
    setTxId(null);

    try {
      const suggestedParams = await getSuggestedParams();
      const sender = activeAccount.address;
      const transactions: algosdk.Transaction[] = [];

      // Calculate amounts in base units
      const amountABase = parseTokenAmount(amountA, tokenA.decimals);
      const amountBBase = parseTokenAmount(amountB, tokenB.decimals);

      // Check if user needs to opt-in to tokens
      if (tokenA.id !== 0) {
        const isOptedInA = await isOptedIntoAsset(sender, tokenA.id);
        if (!isOptedInA) {
          const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            from: sender,
            to: sender,
            assetIndex: tokenA.id,
            amount: 0,
            suggestedParams,
          });
          transactions.push(optInTxn);
        }
      }

      if (tokenB.id !== 0) {
        const isOptedInB = await isOptedIntoAsset(sender, tokenB.id);
        if (!isOptedInB) {
          const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            from: sender,
            to: sender,
            assetIndex: tokenB.id,
            amount: 0,
            suggestedParams,
          });
          transactions.push(optInTxn);
        }
      }

      // Transaction 1: Send token A to pool
      // In production, to would be the actual pool address
      if (tokenA.id === 0) {
        const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          from: sender,
          to: sender, // In production: pool address
          amount: amountABase,
          suggestedParams,
          note: new Uint8Array(Buffer.from('FrySwap: Add liquidity (Token A)')),
        });
        transactions.push(paymentTxn);
      } else {
        const assetTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          from: sender,
          to: sender, // In production: pool address
          assetIndex: tokenA.id,
          amount: amountABase,
          suggestedParams,
          note: new Uint8Array(Buffer.from('FrySwap: Add liquidity (Token A)')),
        });
        transactions.push(assetTxn);
      }

      // Transaction 2: Send token B to pool
      if (tokenB.id === 0) {
        const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          from: sender,
          to: sender, // In production: pool address
          amount: amountBBase,
          suggestedParams,
          note: new Uint8Array(Buffer.from('FrySwap: Add liquidity (Token B)')),
        });
        transactions.push(paymentTxn);
      } else {
        const assetTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          from: sender,
          to: sender, // In production: pool address
          assetIndex: tokenB.id,
          amount: amountBBase,
          suggestedParams,
          note: new Uint8Array(Buffer.from('FrySwap: Add liquidity (Token B)')),
        });
        transactions.push(assetTxn);
      }

      // Assign group ID
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

      // Refresh balances
      const balA = await getAssetBalance(sender, tokenA.id);
      setBalanceA(formatTokenAmount(balA, tokenA.decimals));
      if (tokenB) {
        const balB = await getAssetBalance(sender, tokenB.id);
        setBalanceB(formatTokenAmount(balB, tokenB.decimals));
      }

      // Clear amounts
      setAmountA('');
      setAmountB('');

    } catch (err) {
      console.error('Add liquidity failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to add liquidity. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSelect = (token: Token) => {
    if (selectingToken === 'A') {
      // If selecting the same token as tokenB, swap them
      if (tokenB && token.id === tokenB.id) {
        setTokenB(tokenA);
      }
      setTokenA(token);
    } else if (selectingToken === 'B') {
      // If selecting the same token as tokenA, swap them
      if (token.id === tokenA.id) {
        setTokenA(tokenB || ALGO);
      }
      setTokenB(token);
    }
    setSelectingToken(null);
  };

  const isValid = tokenA && tokenB && amountA && amountB &&
    parseFloat(amountA) > 0 && parseFloat(amountB) > 0;

  // Calculate share of pool
  const calculateShareOfPool = () => {
    if (!poolReserves || !amountA || !tokenA) return 0;

    const reserveA = parseFloat(poolReserves.reserveA);
    if (reserveA === 0) return 100; // New pool, user gets 100%

    const amountABase = parseFloat(amountA) * Math.pow(10, tokenA.decimals);
    const newTotalA = reserveA + amountABase;
    return (amountABase / newTotalA) * 100;
  };

  const shareOfPool = calculateShareOfPool();

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

        {/* Success Message */}
        {txId && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
            <div className="flex items-center justify-between">
              <span>Liquidity added successfully!</span>
              <a
                href={EXPLORER_TX_URL(txId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-300 hover:text-green-200 underline flex items-center gap-1"
              >
                View transaction
                <ExternalLinkIcon className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Pool Status */}
        {tokenA && tokenB && poolExists === false && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm">
            This pool doesn't exist yet. You'll be creating a new pool!
          </div>
        )}

        {/* Token A Input */}
        <TokenInput
          label="Token A"
          token={tokenA}
          amount={amountA}
          onAmountChange={setAmountA}
          onTokenSelect={() => setSelectingToken('A')}
          balance={balanceA}
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
          onTokenSelect={() => setSelectingToken('B')}
          balance={balanceB}
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
                <span className="text-primary-500">{shareOfPool.toFixed(2)}%</span>
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
          disabled={!activeAccount || !isValid || loading}
          className="btn-primary w-full mt-6 py-4 text-lg disabled:opacity-50"
        >
          {loading ? (
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
              Adding Liquidity...
            </span>
          ) : !activeAccount ? (
            'Connect Wallet'
          ) : !tokenB ? (
            'Select tokens'
          ) : !isValid ? (
            'Enter amounts'
          ) : poolExists === false ? (
            'Create Pool & Add Liquidity'
          ) : (
            'Add Liquidity'
          )}
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

      {/* Token Selector Modal */}
      <TokenSelector
        isOpen={selectingToken !== null}
        onClose={() => setSelectingToken(null)}
        onSelect={handleTokenSelect}
        selectedToken={selectingToken === 'A' ? tokenA : tokenB}
        disabledToken={selectingToken === 'A' ? tokenB : tokenA}
      />
    </div>
  );
}
