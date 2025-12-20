# FrySwap

A decentralized exchange (DEX) built on Algorand, with plans for multi-chain support.

## Overview

FrySwap is an automated market maker (AMM) DEX that enables:
- Token swaps with low fees (0.30%)
- Liquidity provision with LP token rewards
- Free public API for price data and quotes
- TypeScript SDK for easy integration

## Architecture

```
fryswap/
├── contracts/       # Smart contracts (PyTeal for Algorand)
├── api/            # REST API service
├── sdk/            # TypeScript SDK
├── web/            # React frontend (Vite + TailwindCSS)
└── packages/       # Shared utilities
```

## Quick Start

### Prerequisites

- Node.js >= 18
- Python >= 3.10 (for contracts)
- Algorand node access (uses Nodely by default)

### Installation

```bash
# Clone the repository
git clone https://github.com/Fry-Foundation/fry-swap.git
cd fry-swap

# Install dependencies
npm install

# Set up Python environment for contracts
cd contracts
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

### Running the API

```bash
# Development
npm run api:dev

# Production
npm run api:start
```

The API will be available at `http://localhost:3000`.

### Running the Web UI

```bash
# Development
npm run web:dev

# Production build
npm run web:build
```

The web UI will be available at `http://localhost:5173`.

## API Endpoints

### Health

- `GET /api/v1/health` - Service health status
- `GET /api/v1/health/live` - Liveness probe
- `GET /api/v1/health/ready` - Readiness probe

### Pools

- `GET /api/v1/pools` - List all pools
- `GET /api/v1/pools/:appId` - Get pool by ID
- `GET /api/v1/pools/pair/:assetA/:assetB` - Get pool by asset pair
- `GET /api/v1/pools/:appId/stats` - Get pool statistics

### Swap

- `GET /api/v1/swap/quote` - Get swap quote
- `POST /api/v1/swap/quote` - Get swap quote (POST)
- `GET /api/v1/swap/route` - Find best swap route

### Prices

- `GET /api/v1/prices` - Get all asset prices
- `GET /api/v1/prices/:assetId` - Get price for asset
- `GET /api/v1/prices/pair/:assetA/:assetB` - Get exchange rate

## SDK Usage

```typescript
import { FrySwap, TESTNET_CONFIG } from '@fryswap/sdk';

// Initialize client
const fryswap = new FrySwap(TESTNET_CONFIG);

// Get a swap quote
const quote = await fryswap.getSwapQuote({
  assetIn: 123456,  // Asset ID
  assetOut: 789012, // Asset ID
  amountIn: 1000000n, // 1 token (6 decimals)
});

console.log(`Output: ${quote.amountOut}`);
console.log(`Price impact: ${(quote.priceImpact * 100).toFixed(2)}%`);

// Execute a swap (requires signing account)
const result = await fryswap.swap(account, {
  assetIn: 123456,
  assetOut: 789012,
  amountIn: 1000000n,
  slippageBps: 50, // 0.5% slippage tolerance
});

console.log(`Swap executed: ${result.txId}`);
```

## Smart Contracts

FrySwap uses three main contracts:

### Pool Contract
- Manages liquidity for a single asset pair
- Implements constant product (x * y = k) AMM
- Issues LP tokens to liquidity providers

### Factory Contract
- Deploys and registers new pools
- Ensures one pool per asset pair
- Manages protocol configuration

### Router Contract
- Handles multi-hop swaps
- Provides unified interface for all DEX operations

### Compiling Contracts

```bash
cd contracts
source venv/bin/activate
python scripts/compile.py
```

Compiled TEAL files will be in `contracts/build/`.

### Deploying Contracts

#### Using PowerShell (Recommended)

The easiest way to deploy is using our interactive PowerShell script:

```powershell
# Windows/PowerShell
.\deploy.ps1

# Compile only (no deployment)
.\deploy.ps1 -CompileOnly

# Deploy with a specific pool
.\deploy.ps1 -DeployPool -AssetA 0 -AssetB 31566704
```

#### Using Python Directly

```bash
cd contracts
source venv/bin/activate

# Compile only
python scripts/deploy.py --compile-only

# Full deployment
python scripts/deploy.py --mnemonic "your 25 word mnemonic here"

# Deploy with a pool (e.g., ALGO/USDC)
python scripts/deploy.py --mnemonic "..." --deploy-pool --asset-a 0 --asset-b 31566704
```

#### Deployment Requirements

- **Algorand account** with at least 5 ALGO
- **Python 3.10+** with pyteal and py-algorand-sdk
- **Network access** to Algorand mainnet (uses Nodely endpoints)

After deployment, contract IDs are saved to `contracts/build/deployment.json`.

## Configuration

### Environment Variables

```bash
# API Configuration
PORT=3000
NODE_ENV=production

# Algorand Network (using Nodely - Mainnet)
ALGORAND_NETWORK=mainnet
ALGOD_SERVER=https://mainnet-api.4160.nodely.dev
ALGOD_PORT=443
INDEXER_SERVER=https://mainnet-idx.4160.nodely.dev
INDEXER_PORT=443

# Contract IDs (set after deployment)
FACTORY_APP_ID=0
ROUTER_APP_ID=0
```

## Development

### Project Structure

- **contracts/**: PyTeal smart contracts for Algorand
- **api/**: Express.js REST API
- **sdk/**: TypeScript SDK for developers
- **web/**: React frontend with TailwindCSS

### Running Tests

```bash
# All tests
npm test

# API tests
npm test --workspace=api

# SDK tests
npm test --workspace=@fryswap/sdk

# Contract tests
cd contracts && pytest
```

### Code Style

```bash
# Lint
npm run lint

# Format
npm run format
```

## Roadmap

- [x] Core AMM contracts (Pool, Factory, Router)
- [x] REST API with free public endpoints
- [x] TypeScript SDK
- [x] Web UI with wallet integration
- [ ] Mainnet deployment
- [ ] Multi-hop routing optimization
- [ ] Concentrated liquidity pools
- [ ] Cross-chain support (EVM chains)
- [ ] Governance token

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- Website: https://fryswap.com (coming soon)
- Documentation: https://docs.fryswap.com (coming soon)
- Twitter: @FryNetworks
- Discord: discord.gg/frynetworks

---

Built with love by **Fry Networks**
