#!/usr/bin/env python3
"""
FrySwap Contract Deployment Script

This script handles the deployment of FrySwap smart contracts to Algorand mainnet.
It compiles contracts, deploys them, and initializes them with the correct parameters.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional, Tuple

from algosdk import account, mnemonic, transaction
from algosdk.v2client import algod
from pyteal import Mode, compileTeal

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.pool import get_approval_program as pool_approval, get_clear_program as pool_clear
from src.factory import get_approval_program as factory_approval, get_clear_program as factory_clear
from src.router import get_approval_program as router_approval, get_clear_program as router_clear


# Default configuration for Algorand Mainnet via Nodely
DEFAULT_ALGOD_ADDRESS = "https://mainnet-api.4160.nodely.dev"
DEFAULT_ALGOD_TOKEN = ""

BUILD_DIR = Path(__file__).parent.parent / "build"
DEPLOYMENT_FILE = BUILD_DIR / "deployment.json"


def get_algod_client(address: str = None, token: str = None) -> algod.AlgodClient:
    """Create an Algod client."""
    address = address or os.getenv("ALGOD_ADDRESS", DEFAULT_ALGOD_ADDRESS)
    token = token or os.getenv("ALGOD_TOKEN", DEFAULT_ALGOD_TOKEN)

    headers = {"X-Algo-API-Token": token} if token else {}
    return algod.AlgodClient(token, address, headers)


def compile_contract(name: str, approval_func, clear_func, version: int = 8) -> Tuple[str, str]:
    """Compile a contract to TEAL."""
    print(f"  Compiling {name}...")

    approval_teal = compileTeal(approval_func(), mode=Mode.Application, version=version)
    clear_teal = compileTeal(clear_func(), mode=Mode.Application, version=version)

    # Save TEAL files
    BUILD_DIR.mkdir(exist_ok=True)
    (BUILD_DIR / f"{name}_approval.teal").write_text(approval_teal)
    (BUILD_DIR / f"{name}_clear.teal").write_text(clear_teal)

    print(f"    ✓ Saved {name}_approval.teal ({len(approval_teal)} bytes)")
    print(f"    ✓ Saved {name}_clear.teal ({len(clear_teal)} bytes)")

    return approval_teal, clear_teal


def wait_for_confirmation(client: algod.AlgodClient, txid: str, timeout: int = 10) -> dict:
    """Wait for a transaction to be confirmed."""
    start_round = client.status()["last-round"] + 1
    current_round = start_round

    while current_round < start_round + timeout:
        try:
            pending = client.pending_transaction_info(txid)
            if pending.get("confirmed-round", 0) > 0:
                return pending
            if pending.get("pool-error"):
                raise Exception(f"Transaction rejected: {pending['pool-error']}")
        except Exception:
            pass

        client.status_after_block(current_round)
        current_round += 1

    raise Exception(f"Transaction {txid} not confirmed after {timeout} rounds")


def deploy_contract(
    client: algod.AlgodClient,
    sender: str,
    private_key: str,
    approval_teal: str,
    clear_teal: str,
    global_schema: transaction.StateSchema,
    local_schema: transaction.StateSchema,
    app_args: list = None,
) -> int:
    """Deploy a smart contract and return the app ID."""

    # Compile TEAL to bytecode
    approval_result = client.compile(approval_teal)
    approval_program = bytes.fromhex(approval_result["result"])

    clear_result = client.compile(clear_teal)
    clear_program = bytes.fromhex(clear_result["result"])

    # Get suggested params
    params = client.suggested_params()

    # Create application create transaction
    txn = transaction.ApplicationCreateTxn(
        sender=sender,
        sp=params,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_program,
        clear_program=clear_program,
        global_schema=global_schema,
        local_schema=local_schema,
        app_args=app_args or [],
    )

    # Sign and submit
    signed_txn = txn.sign(private_key)
    txid = client.send_transaction(signed_txn)
    print(f"    Transaction submitted: {txid}")

    # Wait for confirmation
    result = wait_for_confirmation(client, txid)
    app_id = result["application-index"]

    return app_id


def fund_app_account(
    client: algod.AlgodClient,
    sender: str,
    private_key: str,
    app_id: int,
    amount: int = 1_000_000,  # 1 ALGO minimum
) -> str:
    """Fund the application account with ALGO for minimum balance and inner transactions."""
    app_address = transaction.logic.get_application_address(app_id)

    params = client.suggested_params()
    txn = transaction.PaymentTxn(
        sender=sender,
        sp=params,
        receiver=app_address,
        amt=amount,
    )

    signed_txn = txn.sign(private_key)
    txid = client.send_transaction(signed_txn)
    wait_for_confirmation(client, txid)

    return app_address


def call_app(
    client: algod.AlgodClient,
    sender: str,
    private_key: str,
    app_id: int,
    app_args: list = None,
    foreign_assets: list = None,
    foreign_apps: list = None,
) -> dict:
    """Call an application method."""
    params = client.suggested_params()

    txn = transaction.ApplicationCallTxn(
        sender=sender,
        sp=params,
        index=app_id,
        on_complete=transaction.OnComplete.NoOpOC,
        app_args=app_args or [],
        foreign_assets=foreign_assets or [],
        foreign_apps=foreign_apps or [],
    )

    signed_txn = txn.sign(private_key)
    txid = client.send_transaction(signed_txn)

    return wait_for_confirmation(client, txid)


def deploy_factory(
    client: algod.AlgodClient,
    sender: str,
    private_key: str,
    fee_address: str,
) -> int:
    """Deploy the Factory contract."""
    print("\n📦 Deploying Factory Contract...")

    approval_teal, clear_teal = compile_contract("factory", factory_approval, factory_clear)

    # Factory schema: needs space for pool registry
    global_schema = transaction.StateSchema(num_uints=64, num_byte_slices=16)
    local_schema = transaction.StateSchema(num_uints=0, num_byte_slices=0)

    app_id = deploy_contract(
        client, sender, private_key,
        approval_teal, clear_teal,
        global_schema, local_schema,
    )

    print(f"    ✓ Factory deployed with App ID: {app_id}")

    # Initialize factory
    print("    Initializing factory...")
    call_app(
        client, sender, private_key, app_id,
        app_args=[
            b"initialize",
            bytes.fromhex(sender[0:64]) if len(sender) > 64 else sender.encode(),
            bytes.fromhex(fee_address[0:64]) if len(fee_address) > 64 else fee_address.encode(),
        ],
    )
    print("    ✓ Factory initialized")

    return app_id


def deploy_router(
    client: algod.AlgodClient,
    sender: str,
    private_key: str,
    factory_app_id: int,
) -> int:
    """Deploy the Router contract."""
    print("\n📦 Deploying Router Contract...")

    approval_teal, clear_teal = compile_contract("router", router_approval, router_clear)

    global_schema = transaction.StateSchema(num_uints=8, num_byte_slices=8)
    local_schema = transaction.StateSchema(num_uints=0, num_byte_slices=0)

    app_id = deploy_contract(
        client, sender, private_key,
        approval_teal, clear_teal,
        global_schema, local_schema,
    )

    print(f"    ✓ Router deployed with App ID: {app_id}")

    # Initialize router
    print("    Initializing router...")
    call_app(
        client, sender, private_key, app_id,
        app_args=[
            b"initialize",
            factory_app_id.to_bytes(8, "big"),
            sender.encode() if isinstance(sender, str) else sender,
        ],
        foreign_apps=[factory_app_id],
    )
    print("    ✓ Router initialized")

    return app_id


def deploy_pool(
    client: algod.AlgodClient,
    sender: str,
    private_key: str,
    asset_a_id: int,
    asset_b_id: int,
) -> Tuple[int, int]:
    """Deploy a Pool contract for a specific asset pair."""
    print(f"\n📦 Deploying Pool Contract for assets {asset_a_id}/{asset_b_id}...")

    approval_teal, clear_teal = compile_contract("pool", pool_approval, pool_clear)

    # Pool needs storage for reserves, LP supply, etc.
    global_schema = transaction.StateSchema(num_uints=16, num_byte_slices=4)
    local_schema = transaction.StateSchema(num_uints=0, num_byte_slices=0)

    app_id = deploy_contract(
        client, sender, private_key,
        approval_teal, clear_teal,
        global_schema, local_schema,
    )

    print(f"    ✓ Pool deployed with App ID: {app_id}")

    # Fund the pool for inner transactions
    print("    Funding pool account...")
    app_address = fund_app_account(client, sender, private_key, app_id, 2_000_000)
    print(f"    ✓ Pool account funded: {app_address}")

    # Bootstrap the pool
    print("    Bootstrapping pool...")

    # Ensure assets are ordered (lower ID first, ALGO=0 first)
    if asset_a_id > asset_b_id:
        asset_a_id, asset_b_id = asset_b_id, asset_a_id

    foreign_assets = []
    if asset_a_id != 0:
        foreign_assets.append(asset_a_id)
    foreign_assets.append(asset_b_id)

    result = call_app(
        client, sender, private_key, app_id,
        app_args=[
            b"bootstrap",
            asset_a_id.to_bytes(8, "big"),
            asset_b_id.to_bytes(8, "big"),
        ],
        foreign_assets=foreign_assets,
    )

    # Get LP token ID from inner transaction
    lp_token_id = None
    if "inner-txns" in result:
        for inner in result["inner-txns"]:
            if "asset-index" in inner:
                lp_token_id = inner["asset-index"]
                break

    print(f"    ✓ Pool bootstrapped, LP Token ID: {lp_token_id}")

    return app_id, lp_token_id


def save_deployment(deployment: dict):
    """Save deployment information to file."""
    BUILD_DIR.mkdir(exist_ok=True)
    DEPLOYMENT_FILE.write_text(json.dumps(deployment, indent=2))
    print(f"\n💾 Deployment info saved to: {DEPLOYMENT_FILE}")


def load_deployment() -> Optional[dict]:
    """Load existing deployment information."""
    if DEPLOYMENT_FILE.exists():
        return json.loads(DEPLOYMENT_FILE.read_text())
    return None


def main():
    parser = argparse.ArgumentParser(description="Deploy FrySwap contracts to Algorand")
    parser.add_argument("--mnemonic", help="Deployer account mnemonic (25 words)")
    parser.add_argument("--algod-address", default=DEFAULT_ALGOD_ADDRESS, help="Algod server address")
    parser.add_argument("--algod-token", default="", help="Algod API token")
    parser.add_argument("--fee-address", help="Protocol fee recipient address")
    parser.add_argument("--deploy-pool", action="store_true", help="Also deploy a sample pool")
    parser.add_argument("--asset-a", type=int, default=0, help="First asset ID for pool (0=ALGO)")
    parser.add_argument("--asset-b", type=int, help="Second asset ID for pool")
    parser.add_argument("--compile-only", action="store_true", help="Only compile contracts, don't deploy")

    args = parser.parse_args()

    print("=" * 60)
    print("🍟 FrySwap Contract Deployment")
    print("=" * 60)

    # Compile contracts
    print("\n📝 Compiling contracts...")
    BUILD_DIR.mkdir(exist_ok=True)

    contracts = [
        ("pool", pool_approval, pool_clear),
        ("factory", factory_approval, factory_clear),
        ("router", router_approval, router_clear),
    ]

    for name, approval, clear in contracts:
        compile_contract(name, approval, clear)

    print("\n✅ All contracts compiled successfully!")

    if args.compile_only:
        print("\n--compile-only flag set, skipping deployment.")
        return

    # Get mnemonic
    mnemonic_phrase = args.mnemonic or os.getenv("DEPLOYER_MNEMONIC")
    if not mnemonic_phrase:
        print("\n⚠️  No mnemonic provided. Please provide via --mnemonic or DEPLOYER_MNEMONIC env var")
        mnemonic_phrase = input("Enter deployer mnemonic (25 words): ").strip()

    if not mnemonic_phrase:
        print("❌ Mnemonic required for deployment")
        sys.exit(1)

    # Derive account
    try:
        private_key = mnemonic.to_private_key(mnemonic_phrase)
        sender = account.address_from_private_key(private_key)
    except Exception as e:
        print(f"❌ Invalid mnemonic: {e}")
        sys.exit(1)

    print(f"\n🔑 Deployer address: {sender}")

    # Fee address defaults to deployer
    fee_address = args.fee_address or sender
    print(f"💰 Fee address: {fee_address}")

    # Create client
    client = get_algod_client(args.algod_address, args.algod_token)

    # Check account balance
    try:
        account_info = client.account_info(sender)
        balance = account_info.get("amount", 0)
        print(f"💵 Account balance: {balance / 1_000_000:.6f} ALGO")

        if balance < 5_000_000:  # Need at least 5 ALGO
            print("❌ Insufficient balance. Need at least 5 ALGO for deployment.")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Failed to check account: {e}")
        sys.exit(1)

    # Deploy contracts
    deployment = {
        "network": "mainnet",
        "deployer": sender,
        "fee_address": fee_address,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "contracts": {},
    }

    # Deploy Factory
    factory_id = deploy_factory(client, sender, private_key, fee_address)
    deployment["contracts"]["factory"] = {"app_id": factory_id}

    # Deploy Router
    router_id = deploy_router(client, sender, private_key, factory_id)
    deployment["contracts"]["router"] = {"app_id": router_id}

    # Optionally deploy a pool
    if args.deploy_pool and args.asset_b:
        pool_id, lp_token_id = deploy_pool(
            client, sender, private_key,
            args.asset_a, args.asset_b,
        )
        deployment["contracts"]["pools"] = [{
            "app_id": pool_id,
            "asset_a": args.asset_a,
            "asset_b": args.asset_b,
            "lp_token_id": lp_token_id,
        }]

    # Save deployment info
    save_deployment(deployment)

    print("\n" + "=" * 60)
    print("🎉 Deployment Complete!")
    print("=" * 60)
    print(f"\n  Factory App ID: {factory_id}")
    print(f"  Router App ID:  {router_id}")
    if args.deploy_pool and args.asset_b:
        print(f"  Pool App ID:    {pool_id}")
        print(f"  LP Token ID:    {lp_token_id}")
    print("\n  View on AlgoExplorer:")
    print(f"    https://algoexplorer.io/application/{factory_id}")
    print(f"    https://algoexplorer.io/application/{router_id}")


if __name__ == "__main__":
    main()
