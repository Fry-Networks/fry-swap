/**
 * Token definitions for FrySwap on Algorand Mainnet
 */

export interface Token {
  id: number;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  verified?: boolean;
}

/**
 * ALGO - Native token
 */
export const ALGO: Token = {
  id: 0,
  symbol: 'ALGO',
  name: 'Algorand',
  decimals: 6,
  logo: '/tokens/algo.svg',
  verified: true,
};

/**
 * FRY Token - Used for platform fees
 */
export const FRY: Token = {
  id: 2485314946,
  symbol: 'FRY',
  name: 'FRY Token',
  decimals: 6,
  logo: '/tokens/fry.svg',
  verified: true,
};

/**
 * FRY Fee Configuration
 */
export const FRY_FEE_ADDRESS = 'E2F2LT2INE75DBOYHQXTCTOP2PAP5MHAXQRXTTCCXFKHQTVG36DJONBQZE';

/**
 * Popular mainnet tokens
 * ASA IDs from Algorand mainnet
 */
export const MAINNET_TOKENS: Token[] = [
  ALGO,
  FRY,
  {
    id: 31566704,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logo: '/tokens/usdc.svg',
    verified: true,
  },
  {
    id: 312769,
    symbol: 'USDT',
    name: 'Tether USDt',
    decimals: 6,
    logo: '/tokens/usdt.svg',
    verified: true,
  },
  {
    id: 386192725,
    symbol: 'goBTC',
    name: 'Wrapped BTC (Wormhole)',
    decimals: 8,
    logo: '/tokens/btc.svg',
    verified: true,
  },
  {
    id: 386195940,
    symbol: 'goETH',
    name: 'Wrapped ETH (Wormhole)',
    decimals: 8,
    logo: '/tokens/eth.svg',
    verified: true,
  },
  {
    id: 887406851,
    symbol: 'VEST',
    name: 'Vestige',
    decimals: 6,
    logo: '/tokens/vest.svg',
    verified: true,
  },
  {
    id: 1007352535,
    symbol: 'GARD',
    name: 'GARD',
    decimals: 6,
    logo: '/tokens/gard.svg',
    verified: true,
  },
  {
    id: 470842789,
    symbol: 'DEFLY',
    name: 'Defly Token',
    decimals: 6,
    logo: '/tokens/defly.svg',
    verified: true,
  },
  {
    id: 523683256,
    symbol: 'AKTA',
    name: 'Akita Inu',
    decimals: 0,
    logo: '/tokens/akta.svg',
    verified: true,
  },
  {
    id: 287867876,
    symbol: 'OPUL',
    name: 'Opulous',
    decimals: 10,
    logo: '/tokens/opul.svg',
    verified: true,
  },
  {
    id: 700965019,
    symbol: 'COOP',
    name: 'Coop Coin',
    decimals: 6,
    logo: '/tokens/coop.svg',
    verified: true,
  },
];

/**
 * Common trading pairs (base token IDs)
 */
export const COMMON_BASES = [
  ALGO,
  MAINNET_TOKENS.find(t => t.symbol === 'USDC')!,
  MAINNET_TOKENS.find(t => t.symbol === 'USDT')!,
];

/**
 * Get token by ID
 */
export function getTokenById(id: number): Token | undefined {
  return MAINNET_TOKENS.find(t => t.id === id);
}

/**
 * Get token by symbol
 */
export function getTokenBySymbol(symbol: string): Token | undefined {
  return MAINNET_TOKENS.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: bigint | number, decimals: number, maxDecimals = 6): string {
  const value = typeof amount === 'bigint' ? Number(amount) : amount;
  const divisor = Math.pow(10, decimals);
  const formatted = value / divisor;

  if (formatted === 0) return '0';
  if (formatted < 0.000001) return '< 0.000001';

  return formatted.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(maxDecimals, decimals),
  });
}

/**
 * Parse token amount string to base units
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction);
}
