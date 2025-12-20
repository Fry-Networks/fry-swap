"""
FrySwap AMM Pool Contract

Implements a constant product (x * y = k) AMM pool for token swaps on Algorand.
Each pool holds two assets and issues LP tokens to liquidity providers.
"""

from pyteal import (
    Approve,
    App,
    Assert,
    Bytes,
    Expr,
    Global,
    If,
    Int,
    Mode,
    OnComplete,
    Reject,
    Return,
    Router,
    Seq,
    Subroutine,
    TealType,
    Txn,
    abi,
)

from .constants import (
    MINIMUM_LIQUIDITY,
    PRECISION,
    SWAP_FEE_BPS,
    GlobalState,
)


# Create the router for ABI method handling
router = Router(
    name="FrySwapPool",
    bare_calls=Router.BareCallActions(
        no_op=Router.OnCompleteAction.never(),
        opt_in=Router.OnCompleteAction.never(),
        close_out=Router.OnCompleteAction.never(),
        update_application=Router.OnCompleteAction.never(),
        delete_application=Router.OnCompleteAction.never(),
        clear_state=Router.OnCompleteAction.call_only(),
    ),
)


@Subroutine(TealType.uint64)
def sqrt(n: Expr) -> Expr:
    """Calculate integer square root using Newton's method."""
    # Simplified sqrt for MVP - in production use more robust implementation
    return If(
        n == Int(0),
        Int(0),
        # Approximate sqrt using bit shifting
        # This is a placeholder - real implementation needs iterative Newton's method
        n,
    )


@Subroutine(TealType.uint64)
def min_value(a: Expr, b: Expr) -> Expr:
    """Return the minimum of two values."""
    return If(a < b, a, b)


@Subroutine(TealType.uint64)
def calculate_swap_output(
    amount_in: Expr,
    reserve_in: Expr,
    reserve_out: Expr,
) -> Expr:
    """
    Calculate output amount for a swap using constant product formula.

    Formula: amount_out = (amount_in * fee_factor * reserve_out) / (reserve_in * 10000 + amount_in * fee_factor)
    Where fee_factor = 10000 - SWAP_FEE_BPS
    """
    fee_factor = Int(10000 - SWAP_FEE_BPS)
    amount_in_with_fee = amount_in * fee_factor
    numerator = amount_in_with_fee * reserve_out
    denominator = (reserve_in * Int(10000)) + amount_in_with_fee
    return numerator / denominator


@router.method
def bootstrap(
    asset_a: abi.Asset,
    asset_b: abi.Asset,
    *,
    output: abi.Uint64,
) -> Expr:
    """
    Initialize the pool with two assets.
    Can only be called once during pool creation.

    Args:
        asset_a: First asset ID
        asset_b: Second asset ID

    Returns:
        The LP token asset ID created for this pool
    """
    return Seq(
        # Verify pool hasn't been initialized
        Assert(App.globalGet(GlobalState.ASSET_A_ID) == Int(0)),
        # Ensure asset_a < asset_b for consistent ordering
        Assert(asset_a.asset_id() < asset_b.asset_id()),
        # Store asset IDs
        App.globalPut(GlobalState.ASSET_A_ID, asset_a.asset_id()),
        App.globalPut(GlobalState.ASSET_B_ID, asset_b.asset_id()),
        App.globalPut(GlobalState.RESERVE_A, Int(0)),
        App.globalPut(GlobalState.RESERVE_B, Int(0)),
        App.globalPut(GlobalState.TOTAL_LP_SUPPLY, Int(0)),
        App.globalPut(GlobalState.PAUSED, Int(0)),
        # Return placeholder - actual LP token creation handled separately
        output.set(Int(0)),
    )


@router.method
def add_liquidity(
    amount_a: abi.Uint64,
    amount_b: abi.Uint64,
    min_lp_out: abi.Uint64,
    *,
    output: abi.Uint64,
) -> Expr:
    """
    Add liquidity to the pool and receive LP tokens.

    Args:
        amount_a: Amount of asset A to deposit
        amount_b: Amount of asset B to deposit
        min_lp_out: Minimum LP tokens to receive (slippage protection)

    Returns:
        Amount of LP tokens minted
    """
    reserve_a = App.globalGet(GlobalState.RESERVE_A)
    reserve_b = App.globalGet(GlobalState.RESERVE_B)
    total_supply = App.globalGet(GlobalState.TOTAL_LP_SUPPLY)

    return Seq(
        Assert(App.globalGet(GlobalState.PAUSED) == Int(0)),
        Assert(amount_a.get() > Int(0)),
        Assert(amount_b.get() > Int(0)),
        If(
            total_supply == Int(0),
            # Initial liquidity - LP tokens = sqrt(amount_a * amount_b) - MINIMUM_LIQUIDITY
            Seq(
                # Calculate initial LP tokens
                # For MVP, use geometric mean approximation
                output.set(
                    sqrt(amount_a.get() * amount_b.get()) - Int(MINIMUM_LIQUIDITY)
                ),
                Assert(output.get() >= min_lp_out.get()),
            ),
            # Subsequent liquidity - proportional to existing reserves
            Seq(
                # LP tokens = min(amount_a * total_supply / reserve_a, amount_b * total_supply / reserve_b)
                output.set(
                    min_value(
                        (amount_a.get() * total_supply) / reserve_a,
                        (amount_b.get() * total_supply) / reserve_b,
                    )
                ),
                Assert(output.get() >= min_lp_out.get()),
            ),
        ),
        # Update reserves
        App.globalPut(GlobalState.RESERVE_A, reserve_a + amount_a.get()),
        App.globalPut(GlobalState.RESERVE_B, reserve_b + amount_b.get()),
        App.globalPut(GlobalState.TOTAL_LP_SUPPLY, total_supply + output.get()),
    )


@router.method
def remove_liquidity(
    lp_amount: abi.Uint64,
    min_a_out: abi.Uint64,
    min_b_out: abi.Uint64,
    *,
    output: abi.Tuple2[abi.Uint64, abi.Uint64],
) -> Expr:
    """
    Remove liquidity by burning LP tokens.

    Args:
        lp_amount: Amount of LP tokens to burn
        min_a_out: Minimum asset A to receive
        min_b_out: Minimum asset B to receive

    Returns:
        Tuple of (amount_a, amount_b) received
    """
    reserve_a = App.globalGet(GlobalState.RESERVE_A)
    reserve_b = App.globalGet(GlobalState.RESERVE_B)
    total_supply = App.globalGet(GlobalState.TOTAL_LP_SUPPLY)

    amount_a_out = abi.Uint64()
    amount_b_out = abi.Uint64()

    return Seq(
        Assert(lp_amount.get() > Int(0)),
        Assert(total_supply > Int(0)),
        # Calculate amounts to return
        amount_a_out.set((lp_amount.get() * reserve_a) / total_supply),
        amount_b_out.set((lp_amount.get() * reserve_b) / total_supply),
        # Slippage check
        Assert(amount_a_out.get() >= min_a_out.get()),
        Assert(amount_b_out.get() >= min_b_out.get()),
        # Update reserves
        App.globalPut(GlobalState.RESERVE_A, reserve_a - amount_a_out.get()),
        App.globalPut(GlobalState.RESERVE_B, reserve_b - amount_b_out.get()),
        App.globalPut(GlobalState.TOTAL_LP_SUPPLY, total_supply - lp_amount.get()),
        # Return amounts
        output.set(amount_a_out, amount_b_out),
    )


@router.method
def swap(
    amount_in: abi.Uint64,
    min_amount_out: abi.Uint64,
    asset_in: abi.Asset,
    *,
    output: abi.Uint64,
) -> Expr:
    """
    Swap one asset for another.

    Args:
        amount_in: Amount of input asset
        min_amount_out: Minimum output amount (slippage protection)
        asset_in: The asset being sold

    Returns:
        Amount of output asset received
    """
    asset_a = App.globalGet(GlobalState.ASSET_A_ID)
    asset_b = App.globalGet(GlobalState.ASSET_B_ID)
    reserve_a = App.globalGet(GlobalState.RESERVE_A)
    reserve_b = App.globalGet(GlobalState.RESERVE_B)

    return Seq(
        Assert(App.globalGet(GlobalState.PAUSED) == Int(0)),
        Assert(amount_in.get() > Int(0)),
        If(
            asset_in.asset_id() == asset_a,
            # Swapping A for B
            Seq(
                output.set(calculate_swap_output(amount_in.get(), reserve_a, reserve_b)),
                Assert(output.get() >= min_amount_out.get()),
                App.globalPut(GlobalState.RESERVE_A, reserve_a + amount_in.get()),
                App.globalPut(GlobalState.RESERVE_B, reserve_b - output.get()),
            ),
            # Swapping B for A
            Seq(
                Assert(asset_in.asset_id() == asset_b),
                output.set(calculate_swap_output(amount_in.get(), reserve_b, reserve_a)),
                Assert(output.get() >= min_amount_out.get()),
                App.globalPut(GlobalState.RESERVE_B, reserve_b + amount_in.get()),
                App.globalPut(GlobalState.RESERVE_A, reserve_a - output.get()),
            ),
        ),
    )


@router.method(read_only=True)
def get_quote(
    amount_in: abi.Uint64,
    asset_in: abi.Asset,
    *,
    output: abi.Uint64,
) -> Expr:
    """
    Get a quote for a swap without executing it.

    Args:
        amount_in: Amount of input asset
        asset_in: The asset being sold

    Returns:
        Expected output amount
    """
    asset_a = App.globalGet(GlobalState.ASSET_A_ID)
    reserve_a = App.globalGet(GlobalState.RESERVE_A)
    reserve_b = App.globalGet(GlobalState.RESERVE_B)

    return Seq(
        If(
            asset_in.asset_id() == asset_a,
            output.set(calculate_swap_output(amount_in.get(), reserve_a, reserve_b)),
            output.set(calculate_swap_output(amount_in.get(), reserve_b, reserve_a)),
        ),
    )


@router.method(read_only=True)
def get_reserves(
    *,
    output: abi.Tuple2[abi.Uint64, abi.Uint64],
) -> Expr:
    """Get current reserves of both assets."""
    reserve_a = abi.Uint64()
    reserve_b = abi.Uint64()

    return Seq(
        reserve_a.set(App.globalGet(GlobalState.RESERVE_A)),
        reserve_b.set(App.globalGet(GlobalState.RESERVE_B)),
        output.set(reserve_a, reserve_b),
    )


def get_approval_program() -> Expr:
    """Compile the approval program."""
    return router.compile_program(version=8)


def get_clear_program() -> Expr:
    """Compile the clear state program."""
    return Return(Int(1))


if __name__ == "__main__":
    from pyteal import compileTeal

    # Compile to TEAL
    approval = compileTeal(get_approval_program(), mode=Mode.Application, version=8)
    clear = compileTeal(get_clear_program(), mode=Mode.Application, version=8)

    print("=== Approval Program ===")
    print(approval)
    print("\n=== Clear Program ===")
    print(clear)
