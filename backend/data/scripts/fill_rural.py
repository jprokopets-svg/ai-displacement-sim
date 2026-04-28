"""
Fill non-MSA (rural) counties with estimated AI exposure scores.

Problem: ~2,000 US counties have no OEWS occupation data because they're not
in any Metropolitan Statistical Area. These appear as dark gaps on the map.

Approach: Use QCEW industry-level employment (NAICS codes) to estimate each
rural county's AI exposure based on its industry mix.

Method:
1. Sector-level Eloundou exposures are derived empirically from MSA-based
   county data: regress county-level Eloundou scores against QCEW NAICS
   employment shares (non-negative least squares, N=1,243 MSA counties).
2. For each non-MSA county, load QCEW employment by 2-digit NAICS sector.
3. Compute employment-weighted AI exposure from industry mix.
4. Flag these counties as 'estimated' (not occupation-level data).

Assumption: Within a NAICS sector, the occupation mix (and thus AI exposure)
is similar across geographies. This is a reasonable first-order approximation
for broad sectors but misses local specialization.
"""
from __future__ import annotations

import os
import sqlite3

import pandas as pd
import numpy as np

from .config import RAW_DIR, DB_PATH


# NAICS 2-digit sector → Eloundou LLM exposure score
#
# Derived empirically: regress MSA-based county Eloundou scores against
# QCEW NAICS employment shares (NNLS, N=1,243 counties, R²=0.23).
# The R² is modest because the MSA crosswalk flattens within-MSA variation,
# but the coefficients give the sector exposures most consistent with the
# occupation-level Eloundou data we have.
#
# Key deltas from the v1 hardcoded values:
#   Finance (52): 0.75 → 0.35  — was treating entire sector as analysts
#   Prof/Tech (54): 0.70 → 0.49  — includes low-exposure support staff
#   Management (55): 0.65 → 0.24  — management roles have moderate LLM exposure
#   Information (51): 0.72 → 0.56  — includes infrastructure/ops, not just software
#   Real Estate (53): 0.55 → 0.23  — primarily sales/property management
NAICS_SECTOR_EXPOSURE = {
    "11": 0.292,   # Agriculture, Forestry, Fishing, Hunting
    "21": 0.304,   # Mining, Quarrying, Oil/Gas
    "22": 0.188,   # Utilities
    "23": 0.352,   # Construction
    "31": 0.308,   # Manufacturing
    "32": 0.308,   # Manufacturing
    "33": 0.308,   # Manufacturing
    "42": 0.308,   # Wholesale Trade
    "44": 0.309,   # Retail Trade
    "45": 0.309,   # Retail Trade
    "48": 0.321,   # Transportation and Warehousing
    "49": 0.321,   # Transportation and Warehousing
    "51": 0.563,   # Information
    "52": 0.351,   # Finance and Insurance
    "53": 0.226,   # Real Estate
    "54": 0.485,   # Professional, Scientific, Technical Services
    "55": 0.236,   # Management of Companies
    "56": 0.333,   # Admin, Support, Waste Management
    "61": 0.501,   # Educational Services
    "62": 0.294,   # Healthcare and Social Assistance
    "71": 0.361,   # Arts, Entertainment, Recreation
    "72": 0.324,   # Accommodation and Food Services
    "81": 0.395,   # Other Services
    "92": 0.330,   # Public Administration (no regression data; set to overall mean)
    "99": 0.330,   # Unclassified (negligible employment; set to overall mean)
}


def load_qcew_industry_by_county() -> pd.DataFrame:
    """
    Load QCEW employment by 2-digit NAICS sector for every county.
    Returns DataFrame: [county_fips, county_name, naics_2, employment].
    """
    print("  Loading QCEW industry data for all counties...")
    qcew_dir = RAW_DIR / "bls_qcew"

    data_files = list(qcew_dir.rglob("*.csv"))
    if not data_files:
        raise FileNotFoundError("No QCEW CSV files found")

    chunks = []
    for f in data_files:
        try:
            chunk = pd.read_csv(f, dtype=str, low_memory=False)
            if "own_code" not in chunk.columns:
                continue
            # Filter to private sector (own_code=5), 2-digit NAICS (agglvl_code=74)
            # agglvl_code 74 = County, NAICS Sector level
            filtered = chunk[
                (chunk["own_code"].str.strip() == "5") &
                (chunk["agglvl_code"].str.strip() == "74")
            ]
            if len(filtered) > 0:
                chunks.append(filtered[["area_fips", "area_title", "industry_code",
                                        "annual_avg_emplvl"]])
        except Exception:
            continue

    if not chunks:
        raise ValueError("No QCEW industry-level data found")

    df = pd.concat(chunks, ignore_index=True)
    df["county_fips"] = df["area_fips"].str.strip()
    df["county_name"] = df["area_title"].str.strip()
    df["naics_2"] = df["industry_code"].str.strip().str[:2]
    df["employment"] = pd.to_numeric(df["annual_avg_emplvl"], errors="coerce")

    # Keep only valid county FIPS
    # Exclude XX999 codes (QCEW "Unknown/Undefined" catchalls, not real counties)
    # Exclude 72XXX (Puerto Rico — no TopoJSON coverage in US counties map)
    df = df[
        df["county_fips"].str.match(r"^\d{5}$") &
        ~df["county_fips"].str.startswith("00") &
        ~df["county_fips"].str.endswith("999") &
        ~df["county_fips"].str.startswith("72") &
        df["employment"].notna() &
        (df["employment"] > 0)
    ]

    result = df.groupby(["county_fips", "county_name", "naics_2"])["employment"].sum().reset_index()
    print(f"  Loaded industry data for {result['county_fips'].nunique()} counties, "
          f"{len(result)} county-industry records")
    return result


def estimate_rural_county_scores(existing_fips: set) -> pd.DataFrame:
    """
    Estimate AI exposure for counties not in the MSA-based dataset.

    Returns DataFrame matching county_scores schema with an additional
    'is_estimated' column set to True.
    """
    print("\n=== Estimating Rural County Exposure Scores ===")

    industry_data = load_qcew_industry_by_county()

    # Filter to counties NOT already in the MSA-based dataset
    rural = industry_data[~industry_data["county_fips"].isin(existing_fips)]
    print(f"  Rural (non-MSA) counties with QCEW data: {rural['county_fips'].nunique()}")

    # Map NAICS sector → exposure score
    rural = rural.copy()
    rural["sector_exposure"] = rural["naics_2"].map(NAICS_SECTOR_EXPOSURE)
    rural["sector_exposure"] = rural["sector_exposure"].fillna(0.330)  # Default: overall mean

    # Compute employment-weighted exposure per county
    def _county_exposure(group):
        total_emp = group["employment"].sum()
        if total_emp == 0:
            return pd.Series({
                "ai_exposure_score": 0.330,
                "total_employment": 0,
                "exposed_employment": 0,
                "mean_wage_weighted": 0,
                "n_occupations": 0,
            })

        weighted_exp = (group["employment"] * group["sector_exposure"]).sum() / total_emp
        # "Exposed" = employment in sectors with above-median exposure
        median_exp = 0.35
        exposed_emp = group.loc[group["sector_exposure"] > median_exp, "employment"].sum()

        return pd.Series({
            "ai_exposure_score": weighted_exp,
            "total_employment": total_emp,
            "exposed_employment": exposed_emp,
            "mean_wage_weighted": 0,  # No wage data from QCEW at sector level
            "n_occupations": 0,
        })

    county_scores = (
        rural.groupby(["county_fips", "county_name"])
        .apply(_county_exposure, include_groups=False)
        .reset_index()
    )

    county_scores["is_estimated"] = True

    print(f"  Estimated scores for {len(county_scores)} rural counties")
    print(f"  Exposure range: [{county_scores['ai_exposure_score'].min():.3f}, "
          f"{county_scores['ai_exposure_score'].max():.3f}]")
    print(f"  Mean: {county_scores['ai_exposure_score'].mean():.3f}")

    return county_scores


def fill_rural_counties():
    """
    Add estimated rural county scores to the SQLite database.
    Merges with existing MSA-based scores and recomputes percentiles.
    """
    print("=" * 60)
    print("  Filling Rural County Exposure Scores")
    print("=" * 60)

    conn = sqlite3.connect(DB_PATH)

    # Load existing MSA-based scores
    existing = pd.read_sql("SELECT * FROM county_scores", conn)
    existing["is_estimated"] = False
    existing_fips = set(existing["county_fips"])
    print(f"\n  Existing MSA-based counties: {len(existing)}")

    # Estimate rural counties
    rural = estimate_rural_county_scores(existing_fips)

    # Combine
    combined = pd.concat([existing, rural], ignore_index=True)

    # Population floor: counties below this employment threshold are excluded
    # from the choropleth (too few workers for stable occupation estimates).
    # They remain in the DB for search/detail but render as grey on the map.
    DISPLAY_FLOOR = 10_000
    combined["displayed_on_map"] = combined["total_employment"] >= DISPLAY_FLOOR
    n_displayed = combined["displayed_on_map"].sum()
    n_excluded = len(combined) - n_displayed

    # Recompute percentiles across ALL counties (including excluded — their
    # scores are still valid, just low-confidence at this resolution)
    combined["exposure_percentile"] = (
        combined["ai_exposure_score"].rank(pct=True) * 100
    ).round(1)

    print(f"\n  === Combined Results ===")
    print(f"  Total counties: {len(combined)}")
    print(f"  MSA-based: {len(existing)}")
    print(f"  Estimated (rural): {len(rural)}")
    print(f"  Displayed on map (emp >= {DISPLAY_FLOOR:,}): {n_displayed}")
    print(f"  Excluded from map (emp < {DISPLAY_FLOOR:,}): {n_excluded}")
    print(f"  Exposure range: [{combined['ai_exposure_score'].min():.3f}, "
          f"{combined['ai_exposure_score'].max():.3f}]")

    # Write back
    combined.to_sql("county_scores", conn, if_exists="replace", index=False)

    # Recreate index
    conn.execute("CREATE INDEX IF NOT EXISTS idx_county_fips ON county_scores(county_fips)")
    conn.commit()

    count = conn.execute("SELECT COUNT(*) FROM county_scores").fetchone()[0]
    estimated = conn.execute("SELECT COUNT(*) FROM county_scores WHERE is_estimated = 1").fetchone()[0]
    print(f"\n  Database updated: {count} total counties ({estimated} estimated)")

    conn.close()


if __name__ == "__main__":
    fill_rural_counties()
