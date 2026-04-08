"""
Economic Dynamics 1 and 2 for the displacement model.

Dynamic 1 — Competitive Cascade
    Large company automates → reduces prices → small competitor loses share →
    small company closes → workers displaced without direct automation.
    3-7 year lag from initial displacement to small business closure cascade.

    Measured by:
    - Small business concentration: avg employees per establishment (low = more small biz)
    - Sector AI competitive pressure: which sectors have large players deploying AI aggressively
    - Consumer-facing concentration: what % of employment is in consumer-facing small businesses

Dynamic 2 — Trade Policy and Capital Allocation
    Three scenarios affecting robotics and offshoring track weights:
    - Current tariffs: robotics +30%, offshoring baseline
    - Free trade: offshoring +30%, robotics -15%
    - Escalating tariffs: robotics +50%, reshoring paradox visible

    Reshoring paradox: manufacturing activity returns but employment doesn't.
    Measured by manufacturing establishment count trend vs employment trend divergence.

Both dynamics are computed per county from QCEW data.
"""
from __future__ import annotations

import os
import sqlite3

import pandas as pd
import numpy as np

from .config import RAW_DIR, DB_PATH


# ============================================================================
# Sector AI Competitive Pressure Index
# ============================================================================
# Which NAICS sectors have large incumbents aggressively deploying AI?
# High pressure = more likely to trigger competitive cascade.
# Scale 0-1.
SECTOR_AI_PRESSURE = {
    "44": 0.80,  # Retail — Amazon, Walmart AI deployment crushing small retail
    "45": 0.80,  # Retail
    "52": 0.75,  # Finance — JPMorgan, Goldman AI tools vs community banks
    "51": 0.70,  # Information — Google, Meta AI vs small media/advertising
    "72": 0.65,  # Accommodation/Food — chains deploying automation vs independents
    "54": 0.60,  # Professional Services — Accenture/Big 4 AI tools vs small consultancies
    "56": 0.55,  # Admin/Support — large staffing firms AI screening vs small agencies
    "48": 0.50,  # Transportation — Aurora/Waymo vs independent truckers
    "49": 0.50,  # Warehousing — Amazon robotics vs small 3PLs
    "42": 0.45,  # Wholesale — large distributors AI optimization
    "62": 0.40,  # Healthcare — health systems AI vs independent practices
    "81": 0.40,  # Other Services — national chains vs local shops
    "53": 0.35,  # Real Estate — Zillow/Redfin AI vs independent agents
    "71": 0.30,  # Arts/Entertainment
    "61": 0.25,  # Education — EdTech vs independent tutoring
    "23": 0.20,  # Construction — limited AI pressure from large players
    "31": 0.35,  # Manufacturing — varies heavily by subsector
    "32": 0.35,  # Manufacturing
    "33": 0.40,  # Manufacturing (more tech-heavy)
    "11": 0.25,  # Agriculture — large agribusiness vs family farms
    "21": 0.20,  # Mining
    "22": 0.15,  # Utilities — regulated, limited competition
    "92": 0.10,  # Government — no competitive pressure
}

# Consumer-facing sectors (where small business closure directly hits local economy)
CONSUMER_FACING_SECTORS = {"44", "45", "72", "81", "62", "71", "54", "53"}


def compute_county_dynamics(year=2025):
    """
    Compute Dynamic 1 (competitive cascade) and Dynamic 2 (trade policy)
    scores for every county.

    Returns DataFrame with columns:
        county_fips, county_name,
        small_biz_concentration,     — % of employment in small-establishment firms
        consumer_facing_pct,         — % of employment in consumer-facing sectors
        sector_ai_pressure,          — employment-weighted AI competitive pressure
        cascade_score,               — composite cascade vulnerability (0-1)
        cascade_score_lagged,        — cascade score with 3-7 year time lag applied
        manufacturing_emp_pct,       — manufacturing share of employment
        manufacturing_estab_trend,   — establishment density (proxy for activity)
        reshoring_paradox_score,     — divergence between activity and employment trends
    """
    print(f"Computing economic dynamics (year={year})...")
    qcew_dir = RAW_DIR / "bls_qcew"
    csv_files = list(qcew_dir.rglob("*.csv"))
    if not csv_files:
        raise FileNotFoundError("No QCEW data found")

    # Load all county-sector data (agglvl_code 74 = county × NAICS 2-digit sector)
    print("  Loading QCEW county-sector data...")
    chunks = []
    for f in csv_files:
        try:
            chunk = pd.read_csv(f, dtype=str, low_memory=False)
            if "agglvl_code" not in chunk.columns:
                continue
            # agglvl 74 = county, 2-digit NAICS, private
            # agglvl 71 = county, total private (all industries)
            relevant = chunk[
                chunk["own_code"].str.strip().isin(["5"]) &
                chunk["agglvl_code"].str.strip().isin(["71", "74"])
            ]
            if len(relevant) > 0:
                chunks.append(relevant[[
                    "area_fips", "area_title", "industry_code", "agglvl_code",
                    "annual_avg_emplvl", "annual_avg_estabs_count",
                ]])
        except Exception:
            continue

    if not chunks:
        raise ValueError("No QCEW sector data loaded")

    df = pd.concat(chunks, ignore_index=True)
    df["county_fips"] = df["area_fips"].str.strip()
    df["county_name"] = df["area_title"].str.strip()
    df["naics_2"] = df["industry_code"].str.strip().str[:2]
    df["employment"] = pd.to_numeric(df["annual_avg_emplvl"], errors="coerce").fillna(0)
    df["establishments"] = pd.to_numeric(df["annual_avg_estabs_count"], errors="coerce").fillna(0)

    # Filter to valid county FIPS
    df = df[
        df["county_fips"].str.match(r"^\d{5}$") &
        ~df["county_fips"].str.startswith("00") &
        ~df["county_fips"].str.endswith("999") &
        ~df["county_fips"].str.startswith("72")
    ]

    # Split into total (agglvl 71) and sector-level (agglvl 74)
    totals = df[df["agglvl_code"].str.strip() == "71"].copy()
    sectors = df[df["agglvl_code"].str.strip() == "74"].copy()

    print(f"  Counties with total data: {totals['county_fips'].nunique()}")
    print(f"  Counties with sector data: {sectors['county_fips'].nunique()}")

    # ===== DYNAMIC 1: Competitive Cascade =====

    results = []
    for fips in totals["county_fips"].unique():
        county_total = totals[totals["county_fips"] == fips].iloc[0]
        county_sectors = sectors[sectors["county_fips"] == fips]
        total_emp = county_total["employment"]
        total_estabs = county_total["establishments"]
        county_name = county_total["county_name"]

        if total_emp <= 0:
            continue

        # 1. Small business concentration
        # Average employees per establishment — lower = more small businesses
        avg_emp_per_estab = total_emp / max(total_estabs, 1)
        # Normalize: <10 avg = very small biz heavy (score 1.0), >100 = large firms (score 0.0)
        small_biz_score = max(0.0, min(1.0, 1.0 - (avg_emp_per_estab - 10) / 90))

        # 2. Consumer-facing employment percentage
        consumer_emp = county_sectors[
            county_sectors["naics_2"].isin(CONSUMER_FACING_SECTORS)
        ]["employment"].sum()
        consumer_pct = consumer_emp / total_emp

        # 3. Sector AI competitive pressure (employment-weighted)
        weighted_pressure = 0.0
        for _, sector_row in county_sectors.iterrows():
            naics = sector_row["naics_2"]
            emp = sector_row["employment"]
            pressure = SECTOR_AI_PRESSURE.get(naics, 0.20)
            weighted_pressure += emp * pressure
        avg_pressure = weighted_pressure / total_emp if total_emp > 0 else 0.20

        # 4. Composite cascade score
        cascade = (
            small_biz_score * 0.35 +
            consumer_pct * 0.30 +
            avg_pressure * 0.35
        )
        cascade = min(1.0, max(0.0, cascade))

        # 5. Time-lagged cascade: 3-7 year lag from initial displacement
        # Before year 2028 (3 years from 2025): cascade contributes 0
        # 2028-2032: linear ramp to full
        # After 2032: full cascade
        if year <= 2028:
            cascade_lagged = 0.0
        elif year >= 2032:
            cascade_lagged = cascade
        else:
            cascade_lagged = cascade * (year - 2028) / 4.0

        # ===== DYNAMIC 2: Manufacturing / Trade Policy =====

        # Manufacturing employment share
        mfg_emp = county_sectors[
            county_sectors["naics_2"].isin({"31", "32", "33"})
        ]["employment"].sum()
        mfg_pct = mfg_emp / total_emp

        mfg_estabs = county_sectors[
            county_sectors["naics_2"].isin({"31", "32", "33"})
        ]["establishments"].sum()

        # Reshoring paradox score:
        # In high-tariff scenario, manufacturing ACTIVITY (establishments) may grow
        # while manufacturing EMPLOYMENT stays flat or declines due to automation.
        # We proxy this with establishment density vs employment share.
        # High estab count + low employment share = paradox signal.
        mfg_estab_density = mfg_estabs / max(total_estabs, 1)
        if mfg_pct > 0.05:  # Only meaningful for counties with real manufacturing
            # Paradox = establishments growing faster than employment
            # Higher density relative to employment = more automated manufacturing
            reshoring_paradox = min(1.0, max(0.0,
                (mfg_estab_density / max(mfg_pct, 0.01) - 0.5) * 2
            ))
        else:
            reshoring_paradox = 0.0

        results.append({
            "county_fips": fips,
            "county_name": county_name,
            "total_employment": total_emp,
            "total_establishments": total_estabs,
            "avg_emp_per_establishment": round(avg_emp_per_estab, 1),
            "small_biz_concentration": round(small_biz_score, 3),
            "consumer_facing_pct": round(consumer_pct, 3),
            "sector_ai_pressure": round(avg_pressure, 3),
            "cascade_score": round(cascade, 3),
            "cascade_score_lagged": round(cascade_lagged, 3),
            "manufacturing_emp_pct": round(mfg_pct, 3),
            "manufacturing_estab_count": mfg_estabs,
            "reshoring_paradox_score": round(reshoring_paradox, 3),
        })

    result_df = pd.DataFrame(results)
    print(f"  Computed dynamics for {len(result_df)} counties")
    return result_df


def write_dynamics_to_sqlite(df):
    """Write economic dynamics to database."""
    conn = sqlite3.connect(DB_PATH)
    df.to_sql("county_dynamics", conn, if_exists="replace", index=False)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_dynamics_fips ON county_dynamics(county_fips)")
    conn.commit()
    conn.close()
    print(f"  Written {len(df)} county dynamics to database")


def show_county_detail(fips, df, trade_policy="current"):
    """Print a detailed county panel for review."""
    row = df[df["county_fips"] == fips]
    if row.empty:
        print(f"  County {fips} not found")
        return
    r = row.iloc[0]

    print(f"\n  {'=' * 60}")
    print(f"  {r['county_name']} ({fips})")
    print(f"  {'=' * 60}")
    print(f"  Employment: {r['total_employment']:,.0f} across {r['total_establishments']:,.0f} establishments")
    print(f"  Avg employees/establishment: {r['avg_emp_per_establishment']:.1f}")
    print(f"\n  --- DYNAMIC 1: Competitive Cascade ---")
    print(f"  Small business concentration:  {r['small_biz_concentration']:.3f}")
    print(f"  Consumer-facing employment:    {r['consumer_facing_pct']*100:.1f}%")
    print(f"  Sector AI pressure:            {r['sector_ai_pressure']:.3f}")
    print(f"  Cascade score (immediate):     {r['cascade_score']:.3f}")
    print(f"  Cascade score (3-7yr lagged):  {r['cascade_score_lagged']:.3f}")
    print(f"\n  --- DYNAMIC 2: Trade Policy ---")
    print(f"  Manufacturing employment:      {r['manufacturing_emp_pct']*100:.1f}%")
    print(f"  Manufacturing establishments:  {r['manufacturing_estab_count']:,.0f}")
    print(f"  Reshoring paradox score:       {r['reshoring_paradox_score']:.3f}")


def show_trade_policy_comparison(fips, year=2030):
    """Show same county under 3 trade policy scenarios."""
    from .multi_track import compute_multi_track_scores

    print(f"\n  {'=' * 70}")
    print(f"  TRADE POLICY COMPARISON — Year {year}")
    print(f"  {'=' * 70}")

    policies = ["current", "free_trade", "escalating_tariffs"]
    labels = ["Current Tariffs", "Free Trade", "Escalating Tariffs"]

    # Get county name
    conn = sqlite3.connect(DB_PATH)
    county = conn.execute(
        "SELECT county_name FROM county_scores WHERE county_fips = ?", (fips,)
    ).fetchone()
    county_name = county[0] if county else fips
    conn.close()

    print(f"  County: {county_name} ({fips})\n")

    # Get top occupations in this county
    conn = sqlite3.connect(DB_PATH)
    top_occs = conn.execute(
        """SELECT soc_code, occupation_title, employment
           FROM county_occupations WHERE county_fips = ?
           ORDER BY employment DESC LIMIT 5""",
        (fips,),
    ).fetchall()
    conn.close()

    if not top_occs:
        print("  No occupation data for this county")
        return

    # Print header
    print(f"  {'Occupation':<30} ", end="")
    for label in labels:
        print(f"{'':>4}{label:<20}", end="")
    print()
    print(f"  {'-'*90}")

    for soc, title, emp in top_occs:
        short_title = title[:28] if title else soc
        print(f"  {short_title:<30} ", end="")
        for policy in policies:
            df = compute_multi_track_scores(year=year, trade_policy=policy)
            r = df[df["soc_code"] == soc]
            if r.empty:
                print(f"{'N/A':>24}", end="")
            else:
                r = r.iloc[0]
                print(f"  {r['composite_normalized']:.3f} "
                      f"(R:{r['track2_robotics']:.2f} O:{r['track4_offshoring']:.2f})", end="")
        print()

    # Show aggregate manufacturing impact
    print(f"\n  --- Manufacturing County Impact ---")
    conn = sqlite3.connect(DB_PATH)
    dynamics = pd.read_sql(
        "SELECT * FROM county_dynamics WHERE county_fips = ?",
        conn, params=(fips,),
    )
    conn.close()
    if not dynamics.empty:
        d = dynamics.iloc[0]
        print(f"  Manufacturing employment: {d['manufacturing_emp_pct']*100:.1f}%")
        print(f"  Reshoring paradox score: {d['reshoring_paradox_score']:.3f}")
        if d['manufacturing_emp_pct'] > 0.10:
            print(f"  Under ESCALATING TARIFFS: Manufacturing activity may increase")
            print(f"  but employment gains are captured by robotics, not workers.")
            print(f"  This is the reshoring paradox — jobs return to America but not to Americans.")


if __name__ == "__main__":
    # Compute and store
    df = compute_county_dynamics(year=2030)
    write_dynamics_to_sqlite(df)

    # Show high small-biz county
    print("\n\n=== HIGH SMALL BUSINESS CONCENTRATION COUNTY ===")
    # Find a county with high cascade score
    high_cascade = df.nlargest(5, "cascade_score")
    for _, r in high_cascade.iterrows():
        if r["total_employment"] > 5000:
            show_county_detail(r["county_fips"], df)
            break

    # Show manufacturing county
    print("\n\n=== MANUFACTURING COUNTY ===")
    high_mfg = df[df["manufacturing_emp_pct"] > 0.20].nlargest(5, "total_employment")
    if not high_mfg.empty:
        mfg_fips = high_mfg.iloc[0]["county_fips"]
        show_county_detail(mfg_fips, df)
        show_trade_policy_comparison(mfg_fips, year=2030)
