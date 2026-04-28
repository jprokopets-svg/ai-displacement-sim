"""
Bartik shift-share scenario response for county-level AI exposure.

For each county, the scenario adjustment is:
    delta_i = Σ_k (county_employment_share_ik × national_shift_coefficient_k)

where k indexes 2-digit NAICS sectors. The county's adjusted exposure is:
    adjusted_score_i = base_eloundou_score_i + delta_i

National shift coefficients are derived from:
  - Trade Policy: ADH (2013) AER manufacturing employment elasticity,
    propagated through BEA 2024 Input-Output Leontief inverse.
  - Fed Response: Carlino & DeFina (1998) REStat construction/RE/durable-mfg
    rate sensitivity, propagated through BEA IO Leontief inverse.

No coefficient is interpolated or calibrated from priors. Every non-zero
value traces to either a published direct shock magnitude or the BEA IO
propagation matrix.

References:
  Autor, Dorn, Hanson (2013) AER 103(6):2121-68 (trade shocks)
  Carlino & DeFina (1998) REStat 80(4):572-87 (monetary policy)
  Acemoglu et al. (2016) AER 106(1) (network propagation)
  BEA Input-Output Use Table, Summary, 2024 initial release
  Bartik (1991), Goldsmith-Pinkham et al. (2020) AER (shift-share methodology)
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd

from .config import DB_PATH, RAW_DIR


# ============================================================================
# BEA IO-propagated national shift coefficients by 2-digit NAICS
# Units: fractional change in sector employment (e.g., -0.05 = 5% decline)
# ============================================================================

TRADE_POLICY_COEFFICIENTS = {
    "free_trade": {
        "11": -0.04524,  # ADH/USDA direct + IO propagation
        "21": -0.01248,  # BEA IO propagated
        "22": -0.03030,  # BEA IO propagated
        "23": -0.00837,  # BEA IO propagated
        "31": -0.10183,  # ADH direct + IO propagation
        "42": -0.00908,  # BEA IO propagated
        "44": +0.00000,  # BEA IO propagated (near-zero)
        "48": -0.00524,  # BEA IO propagated
        "51": -0.00537,  # BEA IO propagated
        "52": -0.01696,  # BEA IO propagated
        "53": -0.03301,  # BEA IO propagated
        "54": -0.01749,  # BEA IO propagated
        "55": -0.03414,  # BEA IO propagated
        "56": -0.02899,  # BEA IO propagated
        "61": -0.00009,  # BEA IO propagated (near-zero)
        "62": -0.00000,  # BEA IO propagated (near-zero)
        "71": -0.00088,  # BEA IO propagated
        "72": -0.00438,  # BEA IO propagated
        "81": -0.00822,  # BEA IO propagated
        "92": -0.00048,  # BEA IO propagated
        "99": +0.00000,  # Neutral (negligible employment)
    },
    "escalating_tariffs": {
        "11": -0.01516,  # ADH/USDA direct (retaliation) + IO prop
        "21": +0.00651,  # BEA IO propagated
        "22": +0.01531,  # BEA IO propagated
        "23": +0.00429,  # BEA IO propagated
        "31": +0.05398,  # ADH direct (asymmetric) + IO propagation
        "42": +0.00477,  # BEA IO propagated
        "44": +0.00000,  # BEA IO propagated (near-zero)
        "48": +0.00279,  # BEA IO propagated
        "51": +0.00286,  # BEA IO propagated
        "52": +0.00843,  # BEA IO propagated
        "53": +0.01738,  # BEA IO propagated
        "54": +0.00917,  # BEA IO propagated
        "55": +0.01815,  # BEA IO propagated
        "56": +0.01543,  # BEA IO propagated
        "61": +0.00005,  # BEA IO propagated (near-zero)
        "62": +0.00000,  # BEA IO propagated (near-zero)
        "71": +0.00045,  # BEA IO propagated
        "72": +0.00228,  # BEA IO propagated
        "81": +0.00433,  # BEA IO propagated
        "92": +0.00025,  # BEA IO propagated
        "99": +0.00000,  # Neutral
    },
}

FED_RESPONSE_COEFFICIENTS = {
    "cut": {
        "11": +0.00112,  # BEA IO propagated
        "21": +0.00264,  # BEA IO propagated
        "22": +0.00563,  # BEA IO propagated
        "23": +0.02734,  # C&D direct + IO propagation
        "31": +0.01733,  # C&D direct (durables) + IO propagation
        "42": +0.00191,  # BEA IO propagated
        "44": +0.00000,  # BEA IO propagated (near-zero)
        "48": +0.00069,  # BEA IO propagated
        "51": +0.00135,  # BEA IO propagated
        "52": +0.00526,  # BEA IO propagated
        "53": +0.02881,  # C&D direct + IO propagation
        "54": +0.00425,  # BEA IO propagated
        "55": +0.00722,  # BEA IO propagated
        "56": +0.00961,  # BEA IO propagated
        "61": +0.00003,  # BEA IO propagated (near-zero)
        "62": +0.00000,  # BEA IO propagated (near-zero)
        "71": +0.00026,  # BEA IO propagated
        "72": +0.00179,  # BEA IO propagated
        "81": +0.00226,  # BEA IO propagated
        "92": +0.00013,  # BEA IO propagated
        "99": +0.00000,  # Neutral
    },
    "zero": {
        "11": +0.00298,  # BEA IO propagated
        "21": +0.00703,  # BEA IO propagated
        "22": +0.01501,  # BEA IO propagated
        "23": +0.07290,  # C&D direct + IO propagation
        "31": +0.04620,  # C&D direct (durables) + IO propagation
        "42": +0.00509,  # BEA IO propagated
        "44": +0.00000,  # BEA IO propagated (near-zero)
        "48": +0.00185,  # BEA IO propagated
        "51": +0.00360,  # BEA IO propagated
        "52": +0.01403,  # BEA IO propagated
        "53": +0.07683,  # C&D direct + IO propagation
        "54": +0.01133,  # BEA IO propagated
        "55": +0.01926,  # BEA IO propagated
        "56": +0.02562,  # BEA IO propagated
        "61": +0.00007,  # BEA IO propagated (near-zero)
        "62": +0.00000,  # BEA IO propagated (near-zero)
        "71": +0.00070,  # BEA IO propagated
        "72": +0.00477,  # BEA IO propagated
        "81": +0.00604,  # BEA IO propagated
        "92": +0.00035,  # BEA IO propagated
        "99": +0.00000,  # Neutral
    },
}


def _load_county_naics_shares() -> pd.DataFrame:
    """
    Load QCEW employment by 2-digit NAICS for each county and compute
    employment shares within each county.

    Returns DataFrame: [county_fips, naics_2, employment_share]
    """
    import glob

    qcew_dir = RAW_DIR / "bls_qcew"
    csv_files = list(qcew_dir.rglob("*.csv"))

    chunks = []
    for f in csv_files:
        try:
            chunk = pd.read_csv(f, dtype=str, low_memory=False)
            if "own_code" not in chunk.columns:
                continue
            filtered = chunk[
                (chunk["own_code"].str.strip() == "5")
                & (chunk["agglvl_code"].str.strip() == "74")
            ]
            if len(filtered) > 0:
                chunks.append(
                    filtered[["area_fips", "industry_code", "annual_avg_emplvl"]]
                )
        except Exception:
            continue

    df = pd.concat(chunks, ignore_index=True)
    df["county_fips"] = df["area_fips"].str.strip()
    df["naics_2"] = df["industry_code"].str.strip().str[:2]
    df["employment"] = pd.to_numeric(df["annual_avg_emplvl"], errors="coerce").fillna(0)

    # Valid county FIPS only
    df = df[
        df["county_fips"].str.match(r"^\d{5}$")
        & ~df["county_fips"].str.startswith("00")
        & ~df["county_fips"].str.endswith("999")
        & ~df["county_fips"].str.startswith("72")
        & (df["employment"] > 0)
    ]

    # Aggregate and compute shares
    agg = df.groupby(["county_fips", "naics_2"])["employment"].sum().reset_index()
    totals = agg.groupby("county_fips")["employment"].sum().rename("total_emp")
    agg = agg.join(totals, on="county_fips")
    agg["employment_share"] = agg["employment"] / agg["total_emp"]

    return agg[["county_fips", "naics_2", "employment_share"]]


def compute_bartik_adjustments() -> pd.DataFrame:
    """
    Compute Bartik shift-share adjustments for all counties under all
    scenario combinations.

    Returns DataFrame with columns:
        county_fips,
        trade_free_trade, trade_escalating_tariffs,
        fed_cut, fed_zero
    """
    print("=== Computing Bartik Shift-Share Adjustments ===")

    shares = _load_county_naics_shares()
    print(f"  Loaded NAICS shares for {shares['county_fips'].nunique()} counties")

    results = {}

    for scenario_name, coeffs in [
        ("trade_free_trade", TRADE_POLICY_COEFFICIENTS["free_trade"]),
        ("trade_escalating_tariffs", TRADE_POLICY_COEFFICIENTS["escalating_tariffs"]),
        ("fed_cut", FED_RESPONSE_COEFFICIENTS["cut"]),
        ("fed_zero", FED_RESPONSE_COEFFICIENTS["zero"]),
    ]:
        # Map coefficients to each county-sector row
        shares_copy = shares.copy()
        shares_copy["coeff"] = shares_copy["naics_2"].map(coeffs).fillna(0)
        shares_copy["contribution"] = (
            shares_copy["employment_share"] * shares_copy["coeff"]
        )

        # Sum across sectors per county
        county_delta = (
            shares_copy.groupby("county_fips")["contribution"]
            .sum()
            .rename(scenario_name)
        )
        results[scenario_name] = county_delta

    result_df = pd.DataFrame(results).reset_index()
    result_df = result_df.rename(columns={"index": "county_fips"})

    # Fill missing counties with 0
    result_df = result_df.fillna(0)

    print(f"  Computed adjustments for {len(result_df)} counties")
    for col in ["trade_free_trade", "trade_escalating_tariffs", "fed_cut", "fed_zero"]:
        vals = result_df[col]
        print(
            f"    {col:>30s}: [{vals.min():+.5f}, {vals.max():+.5f}]  "
            f"mean={vals.mean():+.5f}"
        )

    return result_df


def write_bartik_to_sqlite(bartik_df: pd.DataFrame):
    """Write Bartik adjustments to the database."""
    conn = sqlite3.connect(DB_PATH)
    bartik_df.to_sql("county_bartik", conn, if_exists="replace", index=False)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_bartik_fips ON county_bartik(county_fips)"
    )
    conn.commit()
    conn.close()
    print(f"  Written {len(bartik_df)} county Bartik adjustments to database")


if __name__ == "__main__":
    df = compute_bartik_adjustments()
    write_bartik_to_sqlite(df)
