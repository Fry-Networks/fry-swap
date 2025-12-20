"""Constants used across FrySwap contracts."""

# Fee configuration (in basis points, 1 bp = 0.01%)
SWAP_FEE_BPS = 30  # 0.30% swap fee
PROTOCOL_FEE_BPS = 5  # 0.05% protocol fee (taken from swap fee)

# Precision for calculations
PRECISION = 1_000_000_000  # 1e9 for high precision math
LP_TOKEN_DECIMALS = 6

# Minimum liquidity to prevent dust attacks
MINIMUM_LIQUIDITY = 1000

# Application state keys
class GlobalState:
    """Global state keys for pool contracts."""

    ASSET_A_ID = b"asset_a"
    ASSET_B_ID = b"asset_b"
    RESERVE_A = b"reserve_a"
    RESERVE_B = b"reserve_b"
    LP_TOKEN_ID = b"lp_token"
    TOTAL_LP_SUPPLY = b"total_lp"
    PROTOCOL_FEE_ADDRESS = b"fee_addr"
    PAUSED = b"paused"
    FACTORY_APP_ID = b"factory"


class LocalState:
    """Local state keys for user positions."""

    LP_BALANCE = b"lp_balance"


# Method selectors for ABI routing
class Methods:
    """ABI method selectors."""

    BOOTSTRAP = "bootstrap"
    ADD_LIQUIDITY = "add_liquidity"
    REMOVE_LIQUIDITY = "remove_liquidity"
    SWAP = "swap"
    GET_QUOTE = "get_quote"
