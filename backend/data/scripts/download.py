"""
Download raw data files from O*NET, BLS, and Census (NBER mirror).

Idempotent — skips files that already exist.

Data sources:
    O*NET 29.1:          Automatic download (verified working)
    BLS QCEW:            Automatic download (verified working, ~1GB)
    Census Delineation:  Automatic download via NBER mirror (verified working)
    BLS OEWS:            MANUAL DOWNLOAD REQUIRED (BLS blocks programmatic access)
    Felten-Raj-Rock:     Not downloaded — computed from O*NET (see compute_aioe.py)
"""
import io
import sys
import zipfile
from pathlib import Path

import requests

from .config import (
    RAW_DIR,
    ONET_FILES,
    BLS_OEWS_URL,
    BLS_OEWS_MANUAL_DOWNLOAD_DIR,
    BLS_OEWS_MANUAL_INSTRUCTIONS,
    BLS_QCEW_URL,
    CENSUS_MSA_DELINEATION_URL,
    TOPOJSON_US_URL,
    ELOUNDOU_CSV_URL,
)


def _download_file(url: str, dest: Path, description: str) -> Path:
    """Download a file if it doesn't already exist."""
    if dest.exists():
        print(f"  [skip] {description} — already exists at {dest.name}")
        return dest

    print(f"  [download] {description}")
    print(f"             {url}")
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    print(f"  [done] saved to {dest.name} ({len(resp.content) / 1024:.0f} KB)")
    return dest


def _download_and_extract_zip(
    url: str, dest_dir: Path, description: str, timeout: int = 300,
) -> Path:
    """Download a zip and extract to dest_dir if not already extracted."""
    marker = dest_dir / ".extracted"
    if marker.exists():
        print(f"  [skip] {description} — already extracted")
        return dest_dir

    print(f"  [download] {description}")
    print(f"             {url}")
    print(f"             (this may take a while for large files...)")
    resp = requests.get(url, timeout=timeout, stream=True)
    resp.raise_for_status()

    # Stream to memory then extract
    content = resp.content
    print(f"  [downloaded] {len(content) / (1024*1024):.0f} MB")

    dest_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        zf.extractall(dest_dir)

    marker.touch()
    print(f"  [done] extracted to {dest_dir.name}/")
    return dest_dir


def download_onet():
    """Download O*NET Abilities, Work Activities, and occupation data."""
    print("\n=== O*NET 29.1 Data ===")
    onet_dir = RAW_DIR / "onet"
    onet_dir.mkdir(parents=True, exist_ok=True)

    for name, url in ONET_FILES.items():
        dest = onet_dir / f"{name}.txt"
        _download_file(url, dest, f"O*NET {name}")


def check_bls_oews() -> bool:
    """
    Check if BLS OEWS data has been manually downloaded.
    If not, print instructions and return False.
    """
    print("\n=== BLS OEWS (Manual Download Check) ===")
    oews_dir = BLS_OEWS_MANUAL_DOWNLOAD_DIR
    oews_dir.mkdir(parents=True, exist_ok=True)

    # Look for any data file in the directory
    data_files = (
        list(oews_dir.rglob("*.xlsx"))
        + list(oews_dir.rglob("*.csv"))
        + list(oews_dir.rglob("*.xls"))
    )

    if data_files:
        print(f"  [ok] Found OEWS data file(s):")
        for f in data_files:
            size_mb = f.stat().st_size / (1024 * 1024)
            print(f"       {f.name} ({size_mb:.1f} MB)")
        return True
    else:
        print(BLS_OEWS_MANUAL_INSTRUCTIONS)
        return False


def download_bls_qcew():
    """Download BLS QCEW annual data for county employment shares (~1GB)."""
    print("\n=== BLS QCEW (Automatic Download) ===")
    qcew_dir = RAW_DIR / "bls_qcew"
    _download_and_extract_zip(BLS_QCEW_URL, qcew_dir, "QCEW annual by area", timeout=600)


def download_census_crosswalk():
    """Download Census MSA-to-county delineation via NBER mirror."""
    print("\n=== Census MSA Delineation (NBER Mirror) ===")
    census_dir = RAW_DIR / "census"
    census_dir.mkdir(parents=True, exist_ok=True)

    dest = census_dir / "cbsa2fipsxw_2023.csv"
    _download_file(CENSUS_MSA_DELINEATION_URL, dest, "CBSA-to-FIPS crosswalk (NBER)")


def download_topojson():
    """Download US counties TopoJSON for the D3 map."""
    print("\n=== US TopoJSON ===")
    geo_dir = RAW_DIR / "geo"
    geo_dir.mkdir(parents=True, exist_ok=True)

    dest = geo_dir / "counties-10m.json"
    _download_file(TOPOJSON_US_URL, dest, "US counties TopoJSON")


def download_eloundou():
    """Download Eloundou et al. 2024 occupation-level exposure CSV."""
    print("\n=== Eloundou et al. 2024 GPT-4 β Scores ===")
    eloundou_dir = RAW_DIR / "eloundou"
    eloundou_dir.mkdir(parents=True, exist_ok=True)

    dest = eloundou_dir / "occ_level.csv"
    _download_file(ELOUNDOU_CSV_URL, dest, "Eloundou occupation exposure (GPT-4 β)")


def download_all():
    """
    Download all raw data sources.
    Returns True if all data is available, False if manual steps remain.
    """
    print("=" * 60)
    print("  Downloading data sources")
    print("=" * 60)

    download_onet()
    oews_ok = check_bls_oews()
    download_bls_qcew()
    download_census_crosswalk()
    download_topojson()
    download_eloundou()

    print("\n" + "=" * 60)
    if oews_ok:
        print("  All data sources available. Ready to process.")
    else:
        print("  BLOCKED: BLS OEWS data missing. See instructions above.")
        print("  After downloading, re-run: python -m backend.data.scripts.run_pipeline process")
    print("=" * 60 + "\n")

    return oews_ok


if __name__ == "__main__":
    ok = download_all()
    if not ok:
        sys.exit(1)
