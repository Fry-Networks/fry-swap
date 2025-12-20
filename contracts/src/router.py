"""
FrySwap Router Contract

Handles multi-hop swaps and provides a unified interface for DEX operations.
Routes trades through the most efficient path across multiple pools.
"""

from pyteal import (
    App,
    Assert,
    Bytes,
    Expr,
    Global,
    Int,
    Mode,
    Return,
    Router,
    Seq,
    TealType,
    Txn,
    abi,
)


class RouterState:
    """Global state keys for router contract."""

    FACTORY_APP_ID = b"factory"
    ADMIN = b"admin"
    PAUSED = b"paused"


router = Router(
    name="FrySwapRouter",
    bare_calls=Router.BareCallActions(
        no_op=Router.OnCompleteAction.never(),
        opt_in=Router.OnCompleteAction.never(),
        close_out=Router.OnCompleteAction.never(),
        update_application=Router.OnCompleteAction.never(),
        delete_application=Router.OnCompleteAction.never(),
        clear_state=Router.OnCompleteAction.call_only(),
    ),
)


@router.method
def initialize(
    factory_app_id: abi.Uint64,
    admin: abi.Address,
) -> Expr:
    """
    Initialize the router contract.

    Args:
        factory_app_id: Application ID of the factory contract
        admin: Admin address
    """
    return Seq(
        Assert(App.globalGet(RouterState.FACTORY_APP_ID) == Int(0)),
        App.globalPut(RouterState.FACTORY_APP_ID, factory_app_id.get()),
        App.globalPut(RouterState.ADMIN, admin.get()),
        App.globalPut(RouterState.PAUSED, Int(0)),
    )


@router.method
def swap_exact_input(
    amount_in: abi.Uint64,
    min_amount_out: abi.Uint64,
    path: abi.DynamicArray[abi.Uint64],
    recipient: abi.Address,
    deadline: abi.Uint64,
    *,
    output: abi.Uint64,
) -> Expr:
    """
    Swap tokens along a specified path with exact input amount.

    Args:
        amount_in: Exact amount of input tokens
        min_amount_out: Minimum acceptable output amount
        path: Array of asset IDs representing the swap path
        recipient: Address to receive output tokens
        deadline: Unix timestamp after which the transaction reverts

    Returns:
        Amount of output tokens received
    """
    return Seq(
        # Check not paused
        Assert(App.globalGet(RouterState.PAUSED) == Int(0)),
        # Check deadline
        Assert(Global.latest_timestamp() <= deadline.get()),
        # Path must have at least 2 assets
        Assert(path.length() >= Int(2)),
        # In production, this would execute swaps through each pool in the path
        # For MVP, placeholder implementation
        output.set(amount_in.get()),  # Placeholder
    )


@router.method
def swap_exact_output(
    max_amount_in: abi.Uint64,
    amount_out: abi.Uint64,
    path: abi.DynamicArray[abi.Uint64],
    recipient: abi.Address,
    deadline: abi.Uint64,
    *,
    output: abi.Uint64,
) -> Expr:
    """
    Swap tokens along a specified path with exact output amount.

    Args:
        max_amount_in: Maximum acceptable input amount
        amount_out: Exact amount of output tokens desired
        path: Array of asset IDs representing the swap path
        recipient: Address to receive output tokens
        deadline: Unix timestamp after which the transaction reverts

    Returns:
        Amount of input tokens used
    """
    return Seq(
        Assert(App.globalGet(RouterState.PAUSED) == Int(0)),
        Assert(Global.latest_timestamp() <= deadline.get()),
        Assert(path.length() >= Int(2)),
        output.set(max_amount_in.get()),  # Placeholder
    )


@router.method
def add_liquidity(
    asset_a: abi.Asset,
    asset_b: abi.Asset,
    amount_a_desired: abi.Uint64,
    amount_b_desired: abi.Uint64,
    amount_a_min: abi.Uint64,
    amount_b_min: abi.Uint64,
    recipient: abi.Address,
    deadline: abi.Uint64,
    *,
    output: abi.Tuple3[abi.Uint64, abi.Uint64, abi.Uint64],
) -> Expr:
    """
    Add liquidity to a pool through the router.

    Args:
        asset_a: First asset
        asset_b: Second asset
        amount_a_desired: Desired amount of asset A
        amount_b_desired: Desired amount of asset B
        amount_a_min: Minimum amount of asset A
        amount_b_min: Minimum amount of asset B
        recipient: Address to receive LP tokens
        deadline: Transaction deadline

    Returns:
        Tuple of (amount_a_used, amount_b_used, lp_tokens_received)
    """
    amount_a = abi.Uint64()
    amount_b = abi.Uint64()
    lp_tokens = abi.Uint64()

    return Seq(
        Assert(App.globalGet(RouterState.PAUSED) == Int(0)),
        Assert(Global.latest_timestamp() <= deadline.get()),
        # Placeholder - actual implementation would call pool contract
        amount_a.set(amount_a_desired.get()),
        amount_b.set(amount_b_desired.get()),
        lp_tokens.set(Int(0)),
        output.set(amount_a, amount_b, lp_tokens),
    )


@router.method
def remove_liquidity(
    asset_a: abi.Asset,
    asset_b: abi.Asset,
    lp_amount: abi.Uint64,
    amount_a_min: abi.Uint64,
    amount_b_min: abi.Uint64,
    recipient: abi.Address,
    deadline: abi.Uint64,
    *,
    output: abi.Tuple2[abi.Uint64, abi.Uint64],
) -> Expr:
    """
    Remove liquidity from a pool through the router.

    Returns:
        Tuple of (amount_a_received, amount_b_received)
    """
    amount_a = abi.Uint64()
    amount_b = abi.Uint64()

    return Seq(
        Assert(App.globalGet(RouterState.PAUSED) == Int(0)),
        Assert(Global.latest_timestamp() <= deadline.get()),
        # Placeholder
        amount_a.set(Int(0)),
        amount_b.set(Int(0)),
        output.set(amount_a, amount_b),
    )


@router.method(read_only=True)
def get_amounts_out(
    amount_in: abi.Uint64,
    path: abi.DynamicArray[abi.Uint64],
    *,
    output: abi.DynamicArray[abi.Uint64],
) -> Expr:
    """
    Calculate output amounts for each step in a swap path.

    Args:
        amount_in: Input amount
        path: Swap path as array of asset IDs

    Returns:
        Array of amounts at each step
    """
    return Seq(
        Assert(path.length() >= Int(2)),
        # Placeholder - would calculate through each pool
        output.set(path),  # Returns path as placeholder
    )


@router.method
def set_paused(
    paused: abi.Bool,
) -> Expr:
    """Pause/unpause the router. Admin only."""
    return Seq(
        Assert(Txn.sender() == App.globalGet(RouterState.ADMIN)),
        App.globalPut(RouterState.PAUSED, paused.get()),
    )


def get_approval_program() -> Expr:
    """Compile the approval program."""
    return router.compile_program(version=8)


def get_clear_program() -> Expr:
    """Compile the clear state program."""
    return Return(Int(1))


if __name__ == "__main__":
    from pyteal import compileTeal

    approval = compileTeal(get_approval_program(), mode=Mode.Application, version=8)
    clear = compileTeal(get_clear_program(), mode=Mode.Application, version=8)

    print("=== Router Approval Program ===")
    print(approval)
