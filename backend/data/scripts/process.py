from __future__ import annotations
"""
Process and join raw datasets to produce county-level AI exposure scores.

Pipeline:
1. Compute AIOE from O*NET Abilities (replaces external Felten-Raj-Rock download)
2. Load BLS OEWS MSA-level occupation employment (MSA × SOC → employment, wages)
3. Load NBER CBSA-to-county crosswalk (MSA → counties)
4. Load BLS QCEW county employment totals (county → total employment)
5. Crosswalk: distribute MSA occupation counts to counties by QCEW shares
6. Merge AIOE scores onto county-occupation data
7. Aggregate to county-level AI exposure score (employment-weighted)
8. Write to SQLite

Assumption: occupation mix within an MSA is uniform across its counties.
This is the standard academic approach but understates specialization.
See docs/methodology.md for full discussion.
"""
import re
import sqlite3

import numpy as np
import pandas as pd

from .config import RAW_DIR, DB_PATH, ASSUMPTIONS, BLS_OEWS_MANUAL_INSTRUCTIONS, EXPOSURE_SOURCE
from .compute_aioe import compute_aioe
from .compute_eloundou import compute_eloundou


def _normalize_soc(soc_code: str) -> str | None:
    """
    Normalize SOC codes to 6-digit format (XX-XXXX) for joining.
    O*NET uses XX-XXXX.XX, BLS uses XX-XXXX.
    """
    if pd.isna(soc_code):
        return None
    soc_str = str(soc_code).strip()
    match = re.match(r"(\d{2}-\d{4})", soc_str)
    return match.group(1) if match else None


def load_aioe(source: str | None = None) -> pd.DataFrame:
    """
    Load AI exposure scores from the configured source.

    Args:
        source: "frs" for Felten-Raj-Seamans 2021, "eloundou" for Eloundou 2024.
                Defaults to EXPOSURE_SOURCE from config (env var or "eloundou").

    Returns DataFrame with columns: [soc_code, occupation_title, ai_exposure].
    """
    source = source or EXPOSURE_SOURCE
    if source == "eloundou":
        return compute_eloundou()
    elif source == "frs":
        return compute_aioe()
    else:
        raise ValueError(f"Unknown exposure source: {source!r}. Use 'frs' or 'eloundou'.")


def load_bls_oews() -> pd.DataFrame:
    """
    Load BLS OEWS MSA-level employment data.
    Returns DataFrame: [area_code, area_type, soc_code, occ_title, employment, mean_wage].

    Requires manual download — see config.py BLS_OEWS_MANUAL_INSTRUCTIONS.
    """
    print("\nLoading BLS OEWS data...")
    oews_dir = RAW_DIR / "bls_oews"

    # Find the main data file
    data_files = (
        list(oews_dir.rglob("*MSA*dl*"))
        + list(oews_dir.rglob("*ma_dl*"))
        + list(oews_dir.rglob("*all_data*"))
    )
    if not data_files:
        data_files = list(oews_dir.rglob("*.xlsx")) + list(oews_dir.rglob("*.csv"))

    if not data_files:
        print(BLS_OEWS_MANUAL_INSTRUCTIONS)
        raise FileNotFoundError(
            "No OEWS data files found. See instructions above for manual download."
        )

    data_file = data_files[0]
    print(f"  Reading {data_file.name} ({data_file.stat().st_size / (1024*1024):.1f} MB)...")

    if data_file.suffix in (".xlsx", ".xls"):
        df = pd.read_excel(data_file)
    else:
        df = pd.read_csv(data_file)

    print(f"  Raw columns: {list(df.columns)}")

    # Standardize column names (BLS uses AREA, AREA_TYPE, OCC_CODE, etc.)
    col_map = {}
    for col in df.columns:
        col_lower = col.lower().strip()
        if col_lower in ("area", "area_code"):
            col_map[col] = "area_code"
        elif col_lower in ("area_type", "areatype"):
            col_map[col] = "area_type"
        elif col_lower in ("occ_code", "soc", "soc_code"):
            col_map[col] = "soc_code"
        elif col_lower in ("occ_title", "occupation_title", "title"):
            col_map[col] = "occ_title"
        elif col_lower in ("tot_emp", "employment", "emp"):
            col_map[col] = "employment"
        elif col_lower in ("a_mean", "mean_wage", "avg_wage"):
            col_map[col] = "mean_wage"

    df = df.rename(columns=col_map)
    print(f"  Mapped columns: {col_map}")

    # Filter to MSA-level records (area_type == 4 in OEWS)
    if "area_type" in df.columns:
        df["area_type"] = pd.to_numeric(df["area_type"], errors="coerce")
        msa_codes = [2, 4]  # 2 = MSA, 4 = MSA in some versions
        pre_filter = len(df)
        df = df[df["area_type"].isin(msa_codes)]
        print(f"  Filtered to MSA records: {len(df)} (from {pre_filter})")

    # Clean SOC codes
    if "soc_code" in df.columns:
        df["soc_code"] = df["soc_code"].apply(_normalize_soc)

    # Convert employment to numeric
    if "employment" in df.columns:
        df["employment"] = pd.to_numeric(df["employment"], errors="coerce")
    if "mean_wage" in df.columns:
        df["mean_wage"] = pd.to_numeric(df["mean_wage"], errors="coerce")

    df = df.dropna(subset=["soc_code", "area_code", "employment"])
    df = df[df["employment"] > 0]

    print(f"  Final: {len(df)} MSA-occupation records")
    print(f"  {df['area_code'].nunique()} unique MSAs, {df['soc_code'].nunique()} unique occupations")
    print(f"  Total employment: {df['employment'].sum():,.0f}")

    return df


def load_msa_county_crosswalk() -> pd.DataFrame:
    """
    Load NBER CBSA-to-FIPS county crosswalk (CSV).
    Source: https://data.nber.org/cbsa-csa-fips-county-crosswalk/2023/

    Columns in NBER CSV:
        cbsacode, metropolitandivisioncode, csacode, cbsatitle,
        metropolitanmicropolitanstatis, metropolitandivisiontitle, csatitle,
        countycountyequivalent, statename, fipsstatecode, fipscountycode,
        centraloutlyingcounty

    Returns DataFrame: [msa_code, county_fips, county_name, fips_state].
    """
    print("\nLoading MSA-to-county crosswalk (NBER)...")
    xwalk_path = RAW_DIR / "census" / "cbsa2fipsxw_2023.csv"

    if not xwalk_path.exists():
        raise FileNotFoundError(
            f"NBER crosswalk not found at {xwalk_path}. Run download step first."
        )

    df = pd.read_csv(xwalk_path, dtype=str)
    print(f"  Loaded {len(df)} rows, columns: {list(df.columns)}")

    # Build 5-digit county FIPS (state + county)
    df["fips_state"] = df["fipsstatecode"].str.strip().str.zfill(2)
    df["fips_county"] = df["fipscountycode"].str.strip().str.zfill(3)
    df["county_fips"] = df["fips_state"] + df["fips_county"]

    # MSA code (CBSA code), zero-padded to 5 digits
    df["msa_code"] = df["cbsacode"].str.strip().str.zfill(5)

    # County name
    df["county_name"] = df["countycountyequivalent"].str.strip()

    # Filter to Metropolitan Statistical Areas only (exclude Micropolitan)
    metro_mask = df["metropolitanmicropolitanstatis"].str.contains(
        "Metropolitan Statistical Area", na=False
    )
    df = df[metro_mask]

    result = df[["msa_code", "county_fips", "county_name", "fips_state"]].dropna()
    result = result.drop_duplicates()

    print(f"  Metropolitan counties: {len(result)}")
    print(f"  {result['msa_code'].nunique()} MSAs → {result['county_fips'].nunique()} counties")

    return result


def load_qcew_county_employment() -> pd.DataFrame:
    """
    Load QCEW total employment by county for computing employment shares.
    Returns DataFrame: [county_fips, total_employment].
    """
    print("\nLoading QCEW county employment...")
    qcew_dir = RAW_DIR / "bls_qcew"

    data_files = list(qcew_dir.rglob("*.csv"))

    if not data_files:
        raise FileNotFoundError(
            f"No QCEW data files found in {qcew_dir}. Run download step first."
        )

    # QCEW files: area_fips, own_code, industry_code, annual_avg_emplvl
    # We want total private employment (own_code=5, industry_code=10)
    print(f"  Found {len(data_files)} QCEW CSV files")

    chunks = []
    files_read = 0
    for f in data_files:
        try:
            chunk = pd.read_csv(f, dtype=str, low_memory=False)
            if "own_code" in chunk.columns and "industry_code" in chunk.columns:
                chunk = chunk[
                    (chunk["own_code"].str.strip() == "5") &
                    (chunk["industry_code"].str.strip() == "10")
                ]
                if len(chunk) > 0:
                    chunks.append(chunk)
                    files_read += 1
        except Exception:
            continue

    if not chunks:
        raise ValueError("Could not read any QCEW files with employment data")

    print(f"  Read employment data from {files_read} files")
    df = pd.concat(chunks, ignore_index=True)

    # Find employment column
    emp_col = "annual_avg_emplvl" if "annual_avg_emplvl" in df.columns else None
    if emp_col is None:
        emp_cols = [c for c in df.columns if "empl" in c.lower()]
        emp_col = emp_cols[0] if emp_cols else None
    if emp_col is None:
        raise ValueError(f"No employment column found. Columns: {list(df.columns)}")

    result = pd.DataFrame({
        "county_fips": df["area_fips"].str.strip(),
        "total_employment": pd.to_numeric(df[emp_col], errors="coerce"),
    }).dropna()

    # Keep only county-level FIPS (5 digits, not US-level "00xxx")
    result = result[
        result["county_fips"].str.match(r"^\d{5}$") &
        ~result["county_fips"].str.startswith("00")
    ]

    result = result.groupby("county_fips")["total_employment"].sum().reset_index()
    print(f"  Counties with employment data: {len(result)}")
    print(f"  Total private employment: {result['total_employment'].sum():,.0f}")

    return result


def build_county_exposure_scores(
    aioe: pd.DataFrame,
    oews: pd.DataFrame,
    crosswalk: pd.DataFrame,
    qcew: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Join all datasets to produce county-level AI exposure scores.

    Method:
    1. Merge OEWS occupation employment with AIOE scores by SOC code
    2. Get counties in each MSA from NBER crosswalk
    3. Compute each county's employment share within its MSA from QCEW
    4. Distribute MSA occupation employment to counties by share
    5. Compute employment-weighted AI exposure per county

    Returns:
        county_scores: county-level aggregate scores
        county_occupations: county-occupation detail rows
    """
    print("\n=== Building County Exposure Scores ===")

    # Step 1: Merge OEWS with AIOE (with SOC group fallback)
    print("  Joining OEWS with AIOE scores...")
    aioe_lookup = aioe[["soc_code", "ai_exposure"]].copy()

    # Build fallback scores for missing SOC codes using SOC group averages
    # SOC groups share the first 5 characters (e.g., 15-12 for computer occupations)
    aioe_lookup["soc_group"] = aioe_lookup["soc_code"].str[:5]
    group_avgs = aioe_lookup.groupby("soc_group")["ai_exposure"].mean().to_dict()

    # Find OEWS SOCs missing from AIOE and assign group average
    oews_socs = set(oews["soc_code"].dropna().unique())
    aioe_socs = set(aioe_lookup["soc_code"].dropna().unique())
    missing_socs = oews_socs - aioe_socs

    fallback_rows = []
    for soc in missing_socs:
        group = soc[:5]
        if group in group_avgs:
            fallback_rows.append({"soc_code": soc, "ai_exposure": group_avgs[group]})

    if fallback_rows:
        fallback_df = pd.DataFrame(fallback_rows)
        aioe_extended = pd.concat(
            [aioe_lookup[["soc_code", "ai_exposure"]], fallback_df],
            ignore_index=True,
        )
        print(f"  Added {len(fallback_rows)} SOC codes via group-average fallback")
        print(f"  (Still missing: {len(missing_socs) - len(fallback_rows)} codes with no group match)")
    else:
        aioe_extended = aioe_lookup[["soc_code", "ai_exposure"]]

    oews_exposed = oews.merge(aioe_extended, on="soc_code", how="inner")
    print(f"  Matched {len(oews_exposed)} MSA-occupation records with AIOE")
    print(f"  ({len(oews) - len(oews_exposed)} OEWS records had no matching AIOE score)")

    # Step 2: Normalize MSA codes for joining
    oews_exposed["area_code"] = (
        oews_exposed["area_code"].astype(str).str.strip().str.zfill(5)
    )

    # Step 3: County shares within each MSA
    msa_counties = crosswalk.merge(qcew, on="county_fips", how="inner")

    msa_totals = (
        msa_counties.groupby("msa_code")["total_employment"]
        .sum()
        .reset_index()
        .rename(columns={"total_employment": "msa_total_employment"})
    )
    msa_counties = msa_counties.merge(msa_totals, on="msa_code")
    msa_counties["county_share"] = (
        msa_counties["total_employment"] / msa_counties["msa_total_employment"]
    )

    print(f"  County-MSA pairs with employment shares: {len(msa_counties)}")

    # Step 4: Distribute MSA occupations to counties
    county_occ = oews_exposed.merge(
        msa_counties[["msa_code", "county_fips", "county_name", "county_share"]],
        left_on="area_code",
        right_on="msa_code",
        how="inner",
    )
    county_occ["county_employment"] = county_occ["employment"] * county_occ["county_share"]

    print(f"  Distributed to {county_occ['county_fips'].nunique()} counties")

    # Step 5: Build county-occupation detail
    occ_title_col = "occ_title" if "occ_title" in county_occ.columns else "occupation_title"
    county_occupations = county_occ[[
        "county_fips", "county_name", "soc_code", occ_title_col,
        "county_employment", "ai_exposure", "mean_wage",
    ]].copy()
    county_occupations.columns = [
        "county_fips", "county_name", "soc_code", "occupation_title",
        "employment", "ai_exposure", "mean_wage",
    ]

    # Step 6: Employment-weighted county scores
    print("  Computing county-level aggregate scores...")

    median_exp = aioe["ai_exposure"].median()

    def _weighted_exposure(group):
        total_emp = group["county_employment"].sum()
        if total_emp == 0:
            return pd.Series({
                "ai_exposure_score": 0.0,
                "total_employment": 0.0,
                "exposed_employment": 0.0,
                "mean_wage_weighted": 0.0,
                "n_occupations": 0,
            })

        weighted_exp = (
            (group["county_employment"] * group["ai_exposure"]).sum() / total_emp
        )
        exposed_emp = group.loc[
            group["ai_exposure"] > median_exp, "county_employment"
        ].sum()
        mean_wage = (
            (group["county_employment"] * group["mean_wage"].fillna(0)).sum()
            / total_emp
        )

        return pd.Series({
            "ai_exposure_score": weighted_exp,
            "total_employment": total_emp,
            "exposed_employment": exposed_emp,
            "mean_wage_weighted": mean_wage,
            "n_occupations": len(group),
        })

    county_scores = (
        county_occ.groupby(["county_fips", "county_name"])
        .apply(_weighted_exposure, include_groups=False)
        .reset_index()
    )

    county_scores["exposure_percentile"] = (
        county_scores["ai_exposure_score"].rank(pct=True) * 100
    ).round(1)

    print(f"\n  === Results ===")
    print(f"  Counties with scores: {len(county_scores)}")
    print(f"  Exposure range: [{county_scores['ai_exposure_score'].min():.3f}, "
          f"{county_scores['ai_exposure_score'].max():.3f}]")
    print(f"  Mean exposure: {county_scores['ai_exposure_score'].mean():.3f}")
    print(f"\n  Top 10 most exposed counties:")
    for _, row in county_scores.nlargest(10, "ai_exposure_score").iterrows():
        print(f"    {row['county_fips']} {row['county_name']}: "
              f"{row['ai_exposure_score']:.3f} (p{row['exposure_percentile']:.0f}) "
              f"emp={row['total_employment']:,.0f}")

    return county_scores, county_occupations, aioe_extended


def write_to_sqlite(
    county_scores: pd.DataFrame,
    county_occupations: pd.DataFrame,
    aioe: pd.DataFrame,
):
    """Write processed data to SQLite database."""
    print(f"\nWriting to SQLite at {DB_PATH}...")

    conn = sqlite3.connect(DB_PATH)

    county_scores.to_sql("county_scores", conn, if_exists="replace", index=False)
    county_occupations.to_sql("county_occupations", conn, if_exists="replace", index=False)
    aioe.to_sql("occupation_exposure", conn, if_exists="replace", index=False)

    assumptions_df = pd.DataFrame(
        list(ASSUMPTIONS.items()), columns=["key", "description"]
    )
    assumptions_df.to_sql("model_assumptions", conn, if_exists="replace", index=False)

    # Indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_county_fips ON county_scores(county_fips)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_county_occ_fips ON county_occupations(county_fips)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_occ_soc ON occupation_exposure(soc_code)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_county_occ_exposure ON county_occupations(ai_exposure DESC)")

    conn.commit()

    for table in ["county_scores", "county_occupations", "occupation_exposure"]:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"  {table}: {count} rows")

    conn.close()
    print("  Done.")


def run_pipeline(source: str | None = None):
    """Run the full data processing pipeline.

    Args:
        source: Exposure source override ("frs" or "eloundou").
                Defaults to config.EXPOSURE_SOURCE.
    """
    effective_source = source or EXPOSURE_SOURCE
    print("=" * 60)
    print("  AI Displacement Data Pipeline")
    print(f"  Exposure source: {effective_source}")
    print("=" * 60)

    aioe = load_aioe(source=source)
    oews = load_bls_oews()
    crosswalk = load_msa_county_crosswalk()
    qcew = load_qcew_county_employment()

    county_scores, county_occupations, aioe_extended = build_county_exposure_scores(
        aioe, oews, crosswalk, qcew,
    )

    # Build full occupation table for job search (original AIOE + fallback scores)
    # Add titles from OEWS for any occupations missing titles
    oews_titles = oews.groupby("soc_code")["occ_title"].first().to_dict()
    aioe_titles = aioe.set_index("soc_code")["occupation_title"].to_dict()

    aioe_for_db = aioe_extended.copy()
    aioe_for_db["occupation_title"] = aioe_for_db["soc_code"].map(
        lambda s: aioe_titles.get(s) or oews_titles.get(s, "Unknown")
    )

    write_to_sqlite(county_scores, county_occupations, aioe_for_db)

    print("\n" + "=" * 60)
    print("  Pipeline complete.")
    print(f"  Database: {DB_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    run_pipeline()
