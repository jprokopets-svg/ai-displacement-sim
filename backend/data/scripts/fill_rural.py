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


# BEA economic regions — fallback anchors for states with < 3 MSA counties.
BEA_REGIONS = {
    "Northeast": [
        "09", "23", "25", "33", "34", "36", "42", "44", "50",
    ],
    "Midwest": [
        "17", "18", "19", "20", "26", "27", "29", "31", "38", "39", "46", "55",
    ],
    "South": [
        "01", "05", "10", "11", "12", "13", "21", "22", "24", "28",
        "37", "40", "45", "47", "48", "51", "54",
    ],
    "West": [
        "02", "04", "06", "08", "15", "16", "30", "32", "35", "41", "49", "53", "56",
    ],
}

STATE_TO_REGION = {}
for _region, _fips_list in BEA_REGIONS.items():
    for _fips in _fips_list:
        STATE_TO_REGION[_fips] = _region


def _compute_anchors(combined: pd.DataFrame) -> tuple:
    """
    Compute state-level and BEA-region-level exposure anchors from
    MSA-based counties only (higher-resolution occupation-level data).

    Returns (state_anchors, region_anchors, national_anchor, fallback_states).
    """
    msa = combined[combined["is_estimated"] == False].copy()
    msa["state_fips"] = msa["county_fips"].str[:2]

    # State-level anchors: employment-weighted mean Eloundou score
    state_anchors = {}
    state_msa_counts = {}
    for state, group in msa.groupby("state_fips"):
        total_emp = group["total_employment"].sum()
        if total_emp > 0:
            state_anchors[state] = (
                (group["total_employment"] * group["ai_exposure_score"]).sum()
                / total_emp
            )
        state_msa_counts[state] = len(group)

    # BEA region anchors for fallback
    region_anchors = {}
    for region, state_list in BEA_REGIONS.items():
        region_msa = msa[msa["state_fips"].isin(state_list)]
        total_emp = region_msa["total_employment"].sum()
        if total_emp > 0:
            region_anchors[region] = (
                (region_msa["total_employment"] * region_msa["ai_exposure_score"]).sum()
                / total_emp
            )

    # National anchor (all MSA counties)
    national_total = msa["total_employment"].sum()
    national_anchor = (
        (msa["total_employment"] * msa["ai_exposure_score"]).sum() / national_total
        if national_total > 0 else 0.33
    )

    # Identify states needing fallback (< 3 MSA counties)
    all_states = set(combined["county_fips"].str[:2])
    fallback_states = {}
    for state in all_states:
        msa_count = state_msa_counts.get(state, 0)
        if msa_count < 3:
            region = STATE_TO_REGION.get(state)
            if region and region in region_anchors:
                fallback_states[state] = ("region", region, region_anchors[region])
            else:
                fallback_states[state] = ("national", "US", national_anchor)

    return state_anchors, region_anchors, national_anchor, fallback_states


def _apply_shrinkage(combined: pd.DataFrame) -> pd.DataFrame:
    """
    Apply Fay-Herriot style shrinkage to all county exposure scores.

    final_score_i = w_i × raw_score_i + (1 - w_i) × anchor_i
    w_i = N_i / (N_i + k)
    k = median total_employment across all counties

    Reference: Fay & Herriot 1979, JASA 74(366):269-277.
    """
    print("\n=== Applying Fay-Herriot Shrinkage ===")

    state_anchors, region_anchors, national_anchor, fallback_states = (
        _compute_anchors(combined)
    )

    # k = median employment across all counties
    k = combined["total_employment"].median()
    print(f"  k (median employment): {k:,.0f}")

    # Show shrinkage weight at key percentiles
    emp_sorted = combined["total_employment"].sort_values()
    for pct_label, pct in [("p10", 0.10), ("p25", 0.25), ("p50", 0.50),
                           ("p75", 0.75), ("p90", 0.90)]:
        emp_at_pct = emp_sorted.iloc[int(pct * len(emp_sorted))]
        w = emp_at_pct / (emp_at_pct + k)
        print(f"  {pct_label} emp={emp_at_pct:>10,.0f}  w={w:.3f}")

    # Log fallback states
    if fallback_states:
        print(f"\n  States using fallback anchors ({len(fallback_states)}):")
        for state, (kind, name, anchor) in sorted(fallback_states.items()):
            msa_n = len(combined[
                (combined["county_fips"].str[:2] == state) &
                (combined["is_estimated"] == False)
            ])
            print(f"    {state} ({kind}: {name})  anchor={anchor:.4f}  MSA_counties={msa_n}")

    # Store raw scores and apply shrinkage
    combined["raw_exposure_score"] = combined["ai_exposure_score"].copy()
    combined["state_fips"] = combined["county_fips"].str[:2]

    def _get_anchor(state):
        if state in fallback_states:
            return fallback_states[state][2]
        if state in state_anchors:
            return state_anchors[state]
        # Should not happen, but safety fallback
        return national_anchor

    combined["state_anchor"] = combined["state_fips"].apply(_get_anchor)
    combined["shrinkage_weight"] = combined["total_employment"] / (
        combined["total_employment"] + k
    )
    # Handle 0 employment: full shrinkage
    combined.loc[combined["total_employment"] <= 0, "shrinkage_weight"] = 0.0

    combined["ai_exposure_score"] = (
        combined["shrinkage_weight"] * combined["raw_exposure_score"]
        + (1 - combined["shrinkage_weight"]) * combined["state_anchor"]
    )

    # Clean up temp column
    combined.drop(columns=["state_fips"], inplace=True)

    # Round for storage
    combined["shrinkage_weight"] = combined["shrinkage_weight"].round(4)
    combined["state_anchor"] = combined["state_anchor"].round(4)
    combined["raw_exposure_score"] = combined["raw_exposure_score"].round(6)

    print(f"\n  Post-shrinkage exposure range: "
          f"[{combined['ai_exposure_score'].min():.4f}, "
          f"{combined['ai_exposure_score'].max():.4f}]")
    print(f"  Post-shrinkage mean: {combined['ai_exposure_score'].mean():.4f}")

    return combined


def fill_rural_counties():
    """
    Add estimated rural county scores to the SQLite database, then apply
    Fay-Herriot shrinkage to all counties (MSA-based and estimated alike).
    Recomputes percentiles on the final shrunk scores.
    """
    print("=" * 60)
    print("  Filling Rural County Exposure Scores + Fay-Herriot Shrinkage")
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

    # Apply Fay-Herriot shrinkage
    combined = _apply_shrinkage(combined)

    # Recompute percentiles on shrunk scores
    combined["exposure_percentile"] = (
        combined["ai_exposure_score"].rank(pct=True) * 100
    ).round(1)

    # Assign exposure quartile buckets (1-4)
    combined["bucket"] = pd.qcut(
        combined["ai_exposure_score"], q=4, labels=[1, 2, 3, 4],
    ).astype(int)

    # Compute and store bucket boundary values
    sorted_scores = combined["ai_exposure_score"].sort_values().values
    n_total = len(sorted_scores)
    bucket_boundaries = {
        "q1_max": float(sorted_scores[n_total // 4 - 1]),
        "q2_max": float(sorted_scores[n_total // 2 - 1]),
        "q3_max": float(sorted_scores[3 * n_total // 4 - 1]),
        "q4_max": float(sorted_scores[-1]),
        "q1_min": float(sorted_scores[0]),
    }

    BUCKET_LABELS = {1: "Lower", 2: "Lower-mid", 3: "Upper-mid", 4: "Higher"}
    print(f"\n  === Bucket Boundaries ===")
    prev = bucket_boundaries["q1_min"]
    for b in range(1, 5):
        key = f"q{b}_max"
        hi = bucket_boundaries[key]
        count_b = (combined["bucket"] == b).sum()
        print(f"  {BUCKET_LABELS[b]:>10} (Q{b}): [{prev:.4f}, {hi:.4f}]  n={count_b}")
        prev = hi

    print(f"\n  === Combined Results ===")
    print(f"  Total counties: {len(combined)}")
    print(f"  MSA-based: {len(existing)}")
    print(f"  Estimated (rural): {len(rural)}")
    print(f"  Final exposure range: [{combined['ai_exposure_score'].min():.4f}, "
          f"{combined['ai_exposure_score'].max():.4f}]")

    # Write county scores
    combined.to_sql("county_scores", conn, if_exists="replace", index=False)

    # Write bucket boundaries as metadata
    import json as _json
    conn.execute("DELETE FROM model_assumptions WHERE key = 'bucket_boundaries'")
    conn.execute(
        "INSERT INTO model_assumptions (key, description) VALUES (?, ?)",
        ("bucket_boundaries", _json.dumps(bucket_boundaries)),
    )

    # Recreate index
    conn.execute("CREATE INDEX IF NOT EXISTS idx_county_fips ON county_scores(county_fips)")
    conn.commit()

    count = conn.execute("SELECT COUNT(*) FROM county_scores").fetchone()[0]
    estimated = conn.execute("SELECT COUNT(*) FROM county_scores WHERE is_estimated = 1").fetchone()[0]
    print(f"\n  Database updated: {count} total counties ({estimated} estimated)")

    conn.close()


if __name__ == "__main__":
    fill_rural_counties()
