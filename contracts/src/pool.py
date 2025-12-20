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
    Gtxn,
    If,
    InnerTxn,
    InnerTxnBuilder,
    Int,
    Mode,
    OnComplete,
    Reject,
    Return,
    Router,
    ScratchVar,
    Seq,
    Subroutine,
    TealType,
    Txn,
    TxnField,
    TxnType,
    abi,
)

from .constants import (
    MINIMUM_LIQUIDITY,
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
    """
    Calculate integer square root using Newton's method.
    Returns floor(sqrt(n))
    """
    # Use scratch variables for iteration
    x = ScratchVar(TealType.uint64)
    y = ScratchVar(TealType.uint64)

    return Seq(
        # Handle zero case
        If(
            n == Int(0),
            Return(Int(0)),
        ),
        # Initial guess: x = n
        x.store(n),
        # y = (x + n/x) / 2
        y.store((x.load() + n / x.load()) / Int(2)),
        # Newton's method iteration (fixed iterations for determinism)
        # Iteration 1
        If(y.load() < x.load(), x.store(y.load())),
        y.store((x.load() + n / x.load()) / Int(2)),
        # Iteration 2
        If(y.load() < x.load(), x.store(y.load())),
        y.store((x.load() + n / x.load()) / Int(2)),
        # Iteration 3
        If(y.load() < x.load(), x.store(y.load())),
        y.store((x.load() + n / x.load()) / Int(2)),
        # Iteration 4
        If(y.load() < x.load(), x.store(y.load())),
        y.store((x.load() + n / x.load()) / Int(2)),
        # Iteration 5
        If(y.load() < x.load(), x.store(y.load())),
        y.store((x.load() + n / x.load()) / Int(2)),
        # Iteration 6
        If(y.load() < x.load(), x.store(y.load())),
        y.store((x.load() + n / x.load()) / Int(2)),
        # Iteration 7
        If(y.load() < x.load(), x.store(y.load())),
        y.store((x.load() + n / x.load()) / Int(2)),
        # Iteration 8 (sufficient for 64-bit integers)
        If(y.load() < x.load(), x.store(y.load())),
        # Return result
        x.load(),
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


@Subroutine(TealType.none)
def send_asset(receiver: Expr, asset_id: Expr, amount: Expr) -> Expr:
    """Send asset via inner transaction."""
    return Seq(
        InnerTxnBuilder.Begin(),
        If(
            asset_id == Int(0),
            # Send ALGO
            Seq(
                InnerTxnBuilder.SetFields({
                    TxnField.type_enum: TxnType.Payment,
                    TxnField.receiver: receiver,
                    TxnField.amount: amount,
                    TxnField.fee: Int(0),
                }),
            ),
            # Send ASA
            Seq(
                InnerTxnBuilder.SetFields({
                    TxnField.type_enum: TxnType.AssetTransfer,
                    TxnField.asset_receiver: receiver,
                    TxnField.xfer_asset: asset_id,
                    TxnField.asset_amount: amount,
                    TxnField.fee: Int(0),
                }),
            ),
        ),
        InnerTxnBuilder.Submit(),
    )


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
        asset_a: First asset ID (use 0 for ALGO)
        asset_b: Second asset ID

    Returns:
        The LP token asset ID created for this pool
    """
    return Seq(
        # Verify pool hasn't been initialized
        Assert(App.globalGet(GlobalState.ASSET_A_ID) == Int(0)),
        # Ensure asset_a < asset_b for consistent ordering (ALGO=0 always first if included)
        Assert(asset_a.asset_id() < asset_b.asset_id()),
        # Store asset IDs
        App.globalPut(GlobalState.ASSET_A_ID, asset_a.asset_id()),
        App.globalPut(GlobalState.ASSET_B_ID, asset_b.asset_id()),
        App.globalPut(GlobalState.RESERVE_A, Int(0)),
        App.globalPut(GlobalState.RESERVE_B, Int(0)),
        App.globalPut(GlobalState.TOTAL_LP_SUPPLY, Int(0)),
        App.globalPut(GlobalState.PAUSED, Int(0)),
        # Create LP token via inner transaction
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetConfig,
            TxnField.config_asset_total: Int(2**64 - 1),
            TxnField.config_asset_decimals: Int(6),
            TxnField.config_asset_unit_name: Bytes("FRYSLP"),
            TxnField.config_asset_name: Bytes("FrySwap LP Token"),
            TxnField.config_asset_manager: Global.current_application_address(),
            TxnField.config_asset_reserve: Global.current_application_address(),
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        # Store LP token ID
        App.globalPut(GlobalState.LP_TOKEN_ID, InnerTxn.created_asset_id()),
        # Return LP token ID
        output.set(InnerTxn.created_asset_id()),
    )


@router.method
def add_liquidity(
    payment_a: abi.PaymentTransaction,
    payment_b: abi.AssetTransferTransaction,
    min_lp_out: abi.Uint64,
    *,
    output: abi.Uint64,
) -> Expr:
    """
    Add liquidity to the pool and receive LP tokens.

    Args:
        payment_a: Payment transaction for asset A (ALGO or ASA transfer)
        payment_b: Asset transfer transaction for asset B
        min_lp_out: Minimum LP tokens to receive (slippage protection)

    Returns:
        Amount of LP tokens minted
    """
    reserve_a = App.globalGet(GlobalState.RESERVE_A)
    reserve_b = App.globalGet(GlobalState.RESERVE_B)
    total_supply = App.globalGet(GlobalState.TOTAL_LP_SUPPLY)
    lp_token_id = App.globalGet(GlobalState.LP_TOKEN_ID)

    amount_a = ScratchVar(TealType.uint64)
    amount_b = ScratchVar(TealType.uint64)
    lp_tokens = ScratchVar(TealType.uint64)

    return Seq(
        Assert(App.globalGet(GlobalState.PAUSED) == Int(0)),
        # Verify payment destinations
        Assert(payment_a.get().receiver() == Global.current_application_address()),
        Assert(payment_b.get().asset_receiver() == Global.current_application_address()),
        # Get amounts
        amount_a.store(payment_a.get().amount()),
        amount_b.store(payment_b.get().asset_amount()),
        Assert(amount_a.load() > Int(0)),
        Assert(amount_b.load() > Int(0)),
        # Calculate LP tokens
        If(
            total_supply == Int(0),
            # Initial liquidity - LP tokens = sqrt(amount_a * amount_b) - MINIMUM_LIQUIDITY
            Seq(
                lp_tokens.store(
                    sqrt(amount_a.load() * amount_b.load()) - Int(MINIMUM_LIQUIDITY)
                ),
                Assert(lp_tokens.load() > Int(0)),
            ),
            # Subsequent liquidity - proportional to existing reserves
            Seq(
                lp_tokens.store(
                    min_value(
                        (amount_a.load() * total_supply) / reserve_a,
                        (amount_b.load() * total_supply) / reserve_b,
                    )
                ),
            ),
        ),
        # Slippage check
        Assert(lp_tokens.load() >= min_lp_out.get()),
        # Update reserves
        App.globalPut(GlobalState.RESERVE_A, reserve_a + amount_a.load()),
        App.globalPut(GlobalState.RESERVE_B, reserve_b + amount_b.load()),
        App.globalPut(GlobalState.TOTAL_LP_SUPPLY, total_supply + lp_tokens.load()),
        # Send LP tokens to sender
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: Txn.sender(),
            TxnField.xfer_asset: lp_token_id,
            TxnField.asset_amount: lp_tokens.load(),
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        # Return LP tokens minted
        output.set(lp_tokens.load()),
    )


@router.method
def remove_liquidity(
    lp_payment: abi.AssetTransferTransaction,
    min_a_out: abi.Uint64,
    min_b_out: abi.Uint64,
    *,
    output: abi.Tuple2[abi.Uint64, abi.Uint64],
) -> Expr:
    """
    Remove liquidity by burning LP tokens.

    Args:
        lp_payment: LP token transfer to the pool
        min_a_out: Minimum asset A to receive
        min_b_out: Minimum asset B to receive

    Returns:
        Tuple of (amount_a, amount_b) received
    """
    reserve_a = App.globalGet(GlobalState.RESERVE_A)
    reserve_b = App.globalGet(GlobalState.RESERVE_B)
    total_supply = App.globalGet(GlobalState.TOTAL_LP_SUPPLY)
    asset_a_id = App.globalGet(GlobalState.ASSET_A_ID)
    asset_b_id = App.globalGet(GlobalState.ASSET_B_ID)
    lp_token_id = App.globalGet(GlobalState.LP_TOKEN_ID)

    lp_amount = ScratchVar(TealType.uint64)
    amount_a_out = ScratchVar(TealType.uint64)
    amount_b_out = ScratchVar(TealType.uint64)
    result_a = abi.Uint64()
    result_b = abi.Uint64()

    return Seq(
        # Verify LP token transfer
        Assert(lp_payment.get().xfer_asset() == lp_token_id),
        Assert(lp_payment.get().asset_receiver() == Global.current_application_address()),
        lp_amount.store(lp_payment.get().asset_amount()),
        Assert(lp_amount.load() > Int(0)),
        Assert(total_supply > Int(0)),
        # Calculate amounts to return
        amount_a_out.store((lp_amount.load() * reserve_a) / total_supply),
        amount_b_out.store((lp_amount.load() * reserve_b) / total_supply),
        # Slippage check
        Assert(amount_a_out.load() >= min_a_out.get()),
        Assert(amount_b_out.load() >= min_b_out.get()),
        # Update reserves
        App.globalPut(GlobalState.RESERVE_A, reserve_a - amount_a_out.load()),
        App.globalPut(GlobalState.RESERVE_B, reserve_b - amount_b_out.load()),
        App.globalPut(GlobalState.TOTAL_LP_SUPPLY, total_supply - lp_amount.load()),
        # Send assets back to sender
        send_asset(Txn.sender(), asset_a_id, amount_a_out.load()),
        send_asset(Txn.sender(), asset_b_id, amount_b_out.load()),
        # Return amounts
        result_a.set(amount_a_out.load()),
        result_b.set(amount_b_out.load()),
        output.set(result_a, result_b),
    )


@router.method
def swap(
    payment: abi.Transaction,
    min_amount_out: abi.Uint64,
    *,
    output: abi.Uint64,
) -> Expr:
    """
    Swap one asset for another.

    Args:
        payment: Payment/transfer of input asset
        min_amount_out: Minimum output amount (slippage protection)

    Returns:
        Amount of output asset received
    """
    asset_a_id = App.globalGet(GlobalState.ASSET_A_ID)
    asset_b_id = App.globalGet(GlobalState.ASSET_B_ID)
    reserve_a = App.globalGet(GlobalState.RESERVE_A)
    reserve_b = App.globalGet(GlobalState.RESERVE_B)

    amount_in = ScratchVar(TealType.uint64)
    amount_out = ScratchVar(TealType.uint64)
    is_a_to_b = ScratchVar(TealType.uint64)

    return Seq(
        Assert(App.globalGet(GlobalState.PAUSED) == Int(0)),
        # Determine swap direction and get amount
        If(
            payment.get().type_enum() == TxnType.Payment,
            # ALGO payment (asset A is ALGO)
            Seq(
                Assert(asset_a_id == Int(0)),
                Assert(payment.get().receiver() == Global.current_application_address()),
                amount_in.store(payment.get().amount()),
                is_a_to_b.store(Int(1)),
            ),
            # Asset transfer
            Seq(
                Assert(payment.get().asset_receiver() == Global.current_application_address()),
                amount_in.store(payment.get().asset_amount()),
                If(
                    payment.get().xfer_asset() == asset_a_id,
                    is_a_to_b.store(Int(1)),
                    Seq(
                        Assert(payment.get().xfer_asset() == asset_b_id),
                        is_a_to_b.store(Int(0)),
                    ),
                ),
            ),
        ),
        Assert(amount_in.load() > Int(0)),
        # Calculate output
        If(
            is_a_to_b.load() == Int(1),
            # Swapping A for B
            Seq(
                amount_out.store(calculate_swap_output(amount_in.load(), reserve_a, reserve_b)),
                Assert(amount_out.load() >= min_amount_out.get()),
                Assert(amount_out.load() < reserve_b),  # Can't drain pool
                App.globalPut(GlobalState.RESERVE_A, reserve_a + amount_in.load()),
                App.globalPut(GlobalState.RESERVE_B, reserve_b - amount_out.load()),
                # Send output
                send_asset(Txn.sender(), asset_b_id, amount_out.load()),
            ),
            # Swapping B for A
            Seq(
                amount_out.store(calculate_swap_output(amount_in.load(), reserve_b, reserve_a)),
                Assert(amount_out.load() >= min_amount_out.get()),
                Assert(amount_out.load() < reserve_a),  # Can't drain pool
                App.globalPut(GlobalState.RESERVE_B, reserve_b + amount_in.load()),
                App.globalPut(GlobalState.RESERVE_A, reserve_a - amount_out.load()),
                # Send output
                send_asset(Txn.sender(), asset_a_id, amount_out.load()),
            ),
        ),
        output.set(amount_out.load()),
    )


@router.method(read_only=True)
def get_quote(
    amount_in: abi.Uint64,
    asset_in_id: abi.Uint64,
    *,
    output: abi.Uint64,
) -> Expr:
    """
    Get a quote for a swap without executing it.

    Args:
        amount_in: Amount of input asset
        asset_in_id: The asset ID being sold (0 for ALGO)

    Returns:
        Expected output amount
    """
    asset_a = App.globalGet(GlobalState.ASSET_A_ID)
    reserve_a = App.globalGet(GlobalState.RESERVE_A)
    reserve_b = App.globalGet(GlobalState.RESERVE_B)

    return If(
        asset_in_id.get() == asset_a,
        output.set(calculate_swap_output(amount_in.get(), reserve_a, reserve_b)),
        output.set(calculate_swap_output(amount_in.get(), reserve_b, reserve_a)),
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


@router.method(read_only=True)
def get_pool_info(
    *,
    output: abi.Tuple4[abi.Uint64, abi.Uint64, abi.Uint64, abi.Uint64],
) -> Expr:
    """Get pool information: asset_a, asset_b, lp_token_id, total_supply."""
    asset_a = abi.Uint64()
    asset_b = abi.Uint64()
    lp_token = abi.Uint64()
    total_supply = abi.Uint64()

    return Seq(
        asset_a.set(App.globalGet(GlobalState.ASSET_A_ID)),
        asset_b.set(App.globalGet(GlobalState.ASSET_B_ID)),
        lp_token.set(App.globalGet(GlobalState.LP_TOKEN_ID)),
        total_supply.set(App.globalGet(GlobalState.TOTAL_LP_SUPPLY)),
        output.set(asset_a, asset_b, lp_token, total_supply),
    )


@router.method
def set_paused(
    paused: abi.Bool,
) -> Expr:
    """Pause/unpause the pool. Only callable by creator."""
    return Seq(
        Assert(Txn.sender() == Global.creator_address()),
        App.globalPut(GlobalState.PAUSED, paused.get()),
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
