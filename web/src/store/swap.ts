/**
 * Swap store using Zustand
 */

import { create } from 'zustand';
import { Token, ALGO, MAINNET_TOKENS } from '../config/tokens';
import api, { SwapQuote } from '../services/api';

interface SwapState {
  tokenIn: Token;
  tokenOut: Token | null;
  amountIn: string;
  amountOut: string;
  slippageBps: number;
  quote: SwapQuote | null;
  loading: boolean;
  error: string | null;

  // Actions
  setTokenIn: (token: Token) => void;
  setTokenOut: (token: Token | null) => void;
  setAmountIn: (amount: string) => void;
  setAmountOut: (amount: string) => void;
  setSlippage: (bps: number) => void;
  swapTokens: () => void;
  fetchQuote: () => Promise<void>;
  clearError: () => void;
}

export const useSwapStore = create<SwapState>((set, get) => ({
  tokenIn: ALGO,
  tokenOut: MAINNET_TOKENS.find(t => t.symbol === 'USDC') || null,
  amountIn: '',
  amountOut: '',
  slippageBps: 50, // 0.5% default
  quote: null,
  loading: false,
  error: null,

  setTokenIn: (token) => {
    const current = get();
    // If selecting the same token as tokenOut, swap them
    if (current.tokenOut && token.id === current.tokenOut.id) {
      set({ tokenIn: token, tokenOut: current.tokenIn, quote: null });
    } else {
      set({ tokenIn: token, quote: null });
    }
    // Refetch quote
    if (get().amountIn && get().tokenOut) {
      get().fetchQuote();
    }
  },

  setTokenOut: (token) => {
    const current = get();
    // If selecting the same token as tokenIn, swap them
    if (token && token.id === current.tokenIn.id) {
      set({ tokenOut: token, tokenIn: current.tokenOut || ALGO, quote: null });
    } else {
      set({ tokenOut: token, quote: null });
    }
    // Refetch quote
    if (get().amountIn && token) {
      get().fetchQuote();
    }
  },

  setAmountIn: (amount) => {
    set({ amountIn: amount, quote: null });
    // Debounced quote fetch would be better here
    if (amount && parseFloat(amount) > 0 && get().tokenOut) {
      get().fetchQuote();
    } else {
      set({ amountOut: '' });
    }
  },

  setAmountOut: (amount) => set({ amountOut: amount }),

  setSlippage: (bps) => set({ slippageBps: bps }),

  swapTokens: () => {
    const { tokenIn, tokenOut, amountIn, amountOut } = get();
    set({
      tokenIn: tokenOut || ALGO,
      tokenOut: tokenIn,
      amountIn: amountOut,
      amountOut: amountIn,
      quote: null,
    });
    if (get().amountIn && get().tokenOut) {
      get().fetchQuote();
    }
  },

  fetchQuote: async () => {
    const { tokenIn, tokenOut, amountIn, slippageBps } = get();

    if (!tokenOut || !amountIn || parseFloat(amountIn) <= 0) {
      set({ amountOut: '', quote: null });
      return;
    }

    set({ loading: true, error: null });

    try {
      // Convert amount to base units
      const amountInBase = BigInt(
        Math.floor(parseFloat(amountIn) * Math.pow(10, tokenIn.decimals))
      ).toString();

      const { quote } = await api.getSwapQuote({
        assetIn: tokenIn.id,
        assetOut: tokenOut.id,
        amountIn: amountInBase,
        slippageBps,
      });

      // Convert output to display units
      const amountOutDisplay = (
        BigInt(quote.amountOut) / BigInt(Math.pow(10, tokenOut.decimals - 6))
      ).toString();
      const amountOutFormatted = (parseInt(amountOutDisplay) / 1e6).toFixed(6);

      set({
        quote,
        amountOut: amountOutFormatted,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to fetch quote:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch quote',
        loading: false,
        amountOut: '',
        quote: null,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
