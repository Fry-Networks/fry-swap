"""
FrySwap Factory Contract

Manages the creation and registry of AMM pools.
Ensures only one pool exists per asset pair.
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
    Subroutine,
    TealType,
    Txn,
    abi,
)


class FactoryState:
    """Global state keys for factory contract."""

    ADMIN = b"admin"
    POOL_COUNT = b"pool_count"
    PROTOCOL_FEE_ADDRESS = b"fee_addr"
    POOL_TEMPLATE_ID = b"pool_tmpl"


# Create the router for ABI method handling
router = Router(
    name="FrySwapFactory",
    bare_calls=Router.BareCallActions(
        no_op=Router.OnCompleteAction.never(),
        opt_in=Router.OnCompleteAction.never(),
        close_out=Router.OnCompleteAction.never(),
        update_application=Router.OnCompleteAction.never(),
        delete_application=Router.OnCompleteAction.never(),
        clear_state=Router.OnCompleteAction.call_only(),
    ),
)


@Subroutine(TealType.bytes)
def get_pool_key(asset_a: Expr, asset_b: Expr) -> Expr:
    """
    Generate a unique key for an asset pair.
    Assets are ordered so (A,B) and (B,A) produce the same key.
    """
    # Concatenate the smaller asset ID first
    from pyteal import If, Concat, Itob
    return If(
        asset_a < asset_b,
        Concat(Itob(asset_a), Itob(asset_b)),
        Concat(Itob(asset_b), Itob(asset_a)),
    )


@router.method
def initialize(
    admin: abi.Address,
    fee_address: abi.Address,
) -> Expr:
    """
    Initialize the factory contract.

    Args:
        admin: Admin address with upgrade/config permissions
        fee_address: Address to receive protocol fees
    """
    return Seq(
        Assert(App.globalGet(FactoryState.ADMIN) == Bytes("")),
        App.globalPut(FactoryState.ADMIN, admin.get()),
        App.globalPut(FactoryState.PROTOCOL_FEE_ADDRESS, fee_address.get()),
        App.globalPut(FactoryState.POOL_COUNT, Int(0)),
    )


@router.method
def create_pool(
    asset_a: abi.Asset,
    asset_b: abi.Asset,
    *,
    output: abi.Uint64,
) -> Expr:
    """
    Create a new liquidity pool for an asset pair.

    Args:
        asset_a: First asset ID
        asset_b: Second asset ID

    Returns:
        The application ID of the new pool
    """
    pool_key = get_pool_key(asset_a.asset_id(), asset_b.asset_id())

    return Seq(
        # Ensure assets are different
        Assert(asset_a.asset_id() != asset_b.asset_id()),
        # Ensure pool doesn't already exist
        Assert(App.globalGet(pool_key) == Int(0)),
        # In production, this would use inner transactions to deploy pool contract
        # For MVP, we record the intent and pool is deployed externally
        App.globalPut(
            FactoryState.POOL_COUNT,
            App.globalGet(FactoryState.POOL_COUNT) + Int(1),
        ),
        # Return placeholder - actual pool ID set after external deployment
        output.set(Int(0)),
    )


@router.method
def register_pool(
    asset_a: abi.Asset,
    asset_b: abi.Asset,
    pool_app_id: abi.Uint64,
) -> Expr:
    """
    Register an externally deployed pool.
    Only callable by admin.

    Args:
        asset_a: First asset ID
        asset_b: Second asset ID
        pool_app_id: Application ID of the deployed pool
    """
    pool_key = get_pool_key(asset_a.asset_id(), asset_b.asset_id())

    return Seq(
        Assert(Txn.sender() == App.globalGet(FactoryState.ADMIN)),
        Assert(App.globalGet(pool_key) == Int(0)),
        App.globalPut(pool_key, pool_app_id.get()),
    )


@router.method(read_only=True)
def get_pool(
    asset_a: abi.Asset,
    asset_b: abi.Asset,
    *,
    output: abi.Uint64,
) -> Expr:
    """
    Get the pool application ID for an asset pair.

    Args:
        asset_a: First asset ID
        asset_b: Second asset ID

    Returns:
        Pool application ID (0 if pool doesn't exist)
    """
    pool_key = get_pool_key(asset_a.asset_id(), asset_b.asset_id())
    return output.set(App.globalGet(pool_key))


@router.method(read_only=True)
def get_pool_count(
    *,
    output: abi.Uint64,
) -> Expr:
    """Get the total number of pools created."""
    return output.set(App.globalGet(FactoryState.POOL_COUNT))


@router.method
def set_fee_address(
    new_fee_address: abi.Address,
) -> Expr:
    """
    Update the protocol fee recipient address.
    Only callable by admin.
    """
    return Seq(
        Assert(Txn.sender() == App.globalGet(FactoryState.ADMIN)),
        App.globalPut(FactoryState.PROTOCOL_FEE_ADDRESS, new_fee_address.get()),
    )


@router.method
def set_admin(
    new_admin: abi.Address,
) -> Expr:
    """
    Transfer admin privileges.
    Only callable by current admin.
    """
    return Seq(
        Assert(Txn.sender() == App.globalGet(FactoryState.ADMIN)),
        App.globalPut(FactoryState.ADMIN, new_admin.get()),
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

    print("=== Factory Approval Program ===")
    print(approval)
