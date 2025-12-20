#!/usr/bin/env python3
"""
Compile FrySwap contracts to TEAL.
"""

import json
from pathlib import Path
from pyteal import Mode, compileTeal

# Add parent to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.pool import get_approval_program as pool_approval, get_clear_program as pool_clear
from src.factory import get_approval_program as factory_approval, get_clear_program as factory_clear
from src.router import get_approval_program as router_approval, get_clear_program as router_clear


BUILD_DIR = Path(__file__).parent.parent / "build"


def compile_contract(name: str, approval_func, clear_func, version: int = 8):
    """Compile a contract to TEAL files."""
    print(f"Compiling {name}...")

    approval_teal = compileTeal(approval_func(), mode=Mode.Application, version=version)
    clear_teal = compileTeal(clear_func(), mode=Mode.Application, version=version)

    # Write TEAL files
    (BUILD_DIR / f"{name}_approval.teal").write_text(approval_teal)
    (BUILD_DIR / f"{name}_clear.teal").write_text(clear_teal)

    print(f"  ✓ {name}_approval.teal ({len(approval_teal)} bytes)")
    print(f"  ✓ {name}_clear.teal ({len(clear_teal)} bytes)")

    return approval_teal, clear_teal


def main():
    """Compile all contracts."""
    BUILD_DIR.mkdir(exist_ok=True)

    print("=" * 50)
    print("FrySwap Contract Compilation")
    print("=" * 50)
    print()

    contracts = [
        ("pool", pool_approval, pool_clear),
        ("factory", factory_approval, factory_clear),
        ("router", router_approval, router_clear),
    ]

    manifest = {}

    for name, approval, clear in contracts:
        approval_teal, clear_teal = compile_contract(name, approval, clear)
        manifest[name] = {
            "approval_size": len(approval_teal),
            "clear_size": len(clear_teal),
        }

    # Write manifest
    (BUILD_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))

    print()
    print("=" * 50)
    print("Compilation complete!")
    print(f"Output directory: {BUILD_DIR}")
    print("=" * 50)


if __name__ == "__main__":
    main()
