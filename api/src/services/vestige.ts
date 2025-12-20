/**
 * Vestige API Service
 * Fetches token prices from Vestige's free API for Algorand ASAs
 */

interface VestigeAssetPrice {
  price: number;
  price_24h_ago: number;
  change_24h: number;
}

interface CachedPrice {
  price: number;
  priceUsd: number;
  timestamp: number;
}

// Cache for price data (1 minute TTL as per Vestige API caching)
const priceCache: Map<number, CachedPrice> = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute

const VESTIGE_API_BASE = 'https://free-api.vestige.fi';

/**
 * Fetch asset price from Vestige API
 * Returns price in ALGO and USD
 */
export async function getAssetPrice(assetId: number): Promise<{ priceAlgo: number; priceUsd: number }> {
  // Check cache first
  const cached = priceCache.get(assetId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { priceAlgo: cached.price, priceUsd: cached.priceUsd };
  }

  try {
    // Fetch asset price in ALGO
    const response = await fetch(`${VESTIGE_API_BASE}/asset/${assetId}/price`);

    if (!response.ok) {
      throw new Error(`Vestige API error: ${response.status}`);
    }

    const data: VestigeAssetPrice = await response.json();

    // Fetch ALGO/USD price for USD conversion
    const algoUsdPrice = await getAlgoUsdPrice();
    const priceUsd = data.price * algoUsdPrice;

    // Cache the result
    priceCache.set(assetId, {
      price: data.price,
      priceUsd,
      timestamp: Date.now(),
    });

    return { priceAlgo: data.price, priceUsd };
  } catch (error) {
    console.error(`Failed to fetch price for asset ${assetId}:`, error);

    // Return cached value if available (even if stale)
    if (cached) {
      return { priceAlgo: cached.price, priceUsd: cached.priceUsd };
    }

    throw error;
  }
}

// Cache for ALGO/USD price
let algoUsdCache: { price: number; timestamp: number } | null = null;

/**
 * Fetch ALGO/USD price from Vestige API
 */
export async function getAlgoUsdPrice(): Promise<number> {
  // Check cache
  if (algoUsdCache && Date.now() - algoUsdCache.timestamp < CACHE_TTL_MS) {
    return algoUsdCache.price;
  }

  try {
    // USDC has 1:1 USD value, so we can use ALGO/USDC rate
    // Vestige API typically has an endpoint for this
    const response = await fetch(`${VESTIGE_API_BASE}/asset/0/price?currency=usd`);

    if (!response.ok) {
      // Fallback: try getting it from USDC (ASA 31566704) which is pegged to USD
      const usdcResponse = await fetch(`${VESTIGE_API_BASE}/asset/31566704/price`);
      if (usdcResponse.ok) {
        const usdcData: VestigeAssetPrice = await usdcResponse.json();
        // USDC price in ALGO, invert to get ALGO price in USD
        const algoPrice = 1 / usdcData.price;
        algoUsdCache = { price: algoPrice, timestamp: Date.now() };
        return algoPrice;
      }
      throw new Error(`Vestige API error: ${response.status}`);
    }

    const data = await response.json();
    const algoPrice = data.price || data.priceUsd || 0.25; // Fallback to reasonable estimate

    algoUsdCache = { price: algoPrice, timestamp: Date.now() };
    return algoPrice;
  } catch (error) {
    console.error('Failed to fetch ALGO/USD price:', error);

    // Return cached value if available
    if (algoUsdCache) {
      return algoUsdCache.price;
    }

    // Fallback to a reasonable estimate
    return 0.25;
  }
}

/**
 * Calculate value of an amount in USD
 */
export async function getValueInUsd(assetId: number, amount: bigint, decimals: number): Promise<number> {
  if (assetId === 0) {
    // ALGO
    const algoPrice = await getAlgoUsdPrice();
    return (Number(amount) / Math.pow(10, decimals)) * algoPrice;
  }

  const { priceUsd } = await getAssetPrice(assetId);
  return (Number(amount) / Math.pow(10, decimals)) * priceUsd;
}

/**
 * Clear the price cache (useful for testing or forced refresh)
 */
export function clearPriceCache(): void {
  priceCache.clear();
  algoUsdCache = null;
}
