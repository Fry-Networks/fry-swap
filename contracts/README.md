# FrySwap Smart Contracts

Algorand smart contracts for the FrySwap DEX, written in PyTeal.

## Contracts

### Pool (`src/pool.py`)
The core AMM contract that manages a single trading pair.

**Features:**
- Constant product (x * y = k) AMM
- 0.30% swap fee
- LP token minting/burning
- Slippage protection

**Methods:**
- `bootstrap(asset_a, asset_b)` - Initialize pool with asset pair
- `add_liquidity(amount_a, amount_b, min_lp_out)` - Add liquidity
- `remove_liquidity(lp_amount, min_a_out, min_b_out)` - Remove liquidity
- `swap(amount_in, min_amount_out, asset_in)` - Execute swap
- `get_quote(amount_in, asset_in)` - Get swap quote (read-only)
- `get_reserves()` - Get current reserves (read-only)

### Factory (`src/factory.py`)
Manages pool creation and registry.

**Features:**
- One pool per asset pair
- Admin controls
- Protocol fee configuration

**Methods:**
- `initialize(admin, fee_address)` - Initialize factory
- `create_pool(asset_a, asset_b)` - Create new pool
- `register_pool(asset_a, asset_b, pool_app_id)` - Register deployed pool
- `get_pool(asset_a, asset_b)` - Get pool ID for pair (read-only)
- `get_pool_count()` - Get total pools (read-only)

### Router (`src/router.py`)
Provides a unified interface for DEX operations.

**Features:**
- Multi-hop swaps
- Deadline protection
- Pausable

**Methods:**
- `initialize(factory_app_id, admin)` - Initialize router
- `swap_exact_input(...)` - Swap with exact input amount
- `swap_exact_output(...)` - Swap with exact output amount
- `add_liquidity(...)` - Add liquidity via router
- `remove_liquidity(...)` - Remove liquidity via router

## Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Compilation

```bash
python scripts/compile.py
```

Output files will be in `build/`:
- `pool_approval.teal`
- `pool_clear.teal`
- `factory_approval.teal`
- `factory_clear.teal`
- `router_approval.teal`
- `router_clear.teal`
- `manifest.json`

## Testing

```bash
pytest
```

## Deployment

1. Deploy Factory contract
2. Initialize Factory with admin and fee addresses
3. Deploy Router contract
4. Initialize Router with Factory app ID
5. Create pools via Factory

## Security Considerations

- All amounts use 64-bit unsigned integers
- Minimum liquidity lock prevents dust attacks
- Slippage protection on all user-facing operations
- Admin functions protected by sender checks
- Pausable for emergency situations

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| SWAP_FEE_BPS | 30 | 0.30% swap fee |
| PROTOCOL_FEE_BPS | 5 | 0.05% protocol fee |
| MINIMUM_LIQUIDITY | 1000 | Locked on first deposit |
| PRECISION | 1e9 | Calculation precision |
