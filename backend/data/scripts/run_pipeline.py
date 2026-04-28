#!/usr/bin/env python3
"""
CLI entry point for the data pipeline.

Usage:
    python -m backend.data.scripts.run_pipeline [download|process|all] [--source=eloundou|frs]

    download  — Download all raw data sources (OEWS requires manual download)
    process   — Process raw data into county-level exposure scores
    all       — Download and process (default)

    --source=eloundou  — Use Eloundou et al. 2024 GPT-4 β (default)
    --source=frs       — Use Felten-Raj-Seamans 2021 AIOE
"""
import sys
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from backend.data.scripts.download import download_all, check_bls_oews
from backend.data.scripts.process import run_pipeline


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]

    command = args[0] if args else "all"

    # Parse --source flag
    source = None
    for flag in flags:
        if flag.startswith("--source="):
            source = flag.split("=", 1)[1]

    if command == "download":
        download_all()
    elif command == "process":
        # Verify OEWS data exists before processing
        if not check_bls_oews():
            sys.exit(1)
        run_pipeline(source=source)
    elif command == "all":
        all_ok = download_all()
        if not all_ok:
            print("\nSkipping processing — download BLS OEWS first, then run:")
            print("  python -m backend.data.scripts.run_pipeline process")
            sys.exit(1)
        run_pipeline(source=source)
    else:
        print(f"Unknown command: {command}")
        print("Usage: python -m backend.data.scripts.run_pipeline [download|process|all] [--source=eloundou|frs]")
        sys.exit(1)


if __name__ == "__main__":
    main()
