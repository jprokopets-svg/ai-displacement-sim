"""
Dynamic 5 — Government Demand Floor
Dynamic 6 — Deficit Spiral and Corporate Profit Scenario

Dynamic 5: Government spending (17% of GDP + transfers) creates a demand floor.
Counties with high government employment and transfer payment dependency are
more insulated from displacement cascades — government doesn't automate at
market speed.

Measured by:
    - Government employment concentration (federal, state, local from QCEW)
    - Transfer payment dependency (SS, SSI, public assistance from Census ACS)
    - Combined government floor score

Dynamic 6: Two competing fiscal scenarios:
    Sub-A — Corporate profit surge (10x): AI productivity → profit boom →
            tax revenue surge → government can fund displaced workers.
    Sub-B — Deficit spiral: displacement outpaces profits → deficits rise →
            Treasury yields rise → crowds out investment → weaker growth.

Data:
    - QCEW own_code 1,2,3 = federal, state, local government employment
    - Census ACS B19055-B19059 = households receiving transfer payments
    - BEA/CBO baseline deficit projections for Dynamic 6 calibration
"""
from __future__ import annotations

import json
import os
import sqlite3

import pandas as pd
import numpy as np

from .config import RAW_DIR, DB_PATH


def _load_government_employment():
    """Load government employment by county from QCEW."""
    print("  Loading QCEW government employment...")
    qcew_dir = RAW_DIR / "bls_qcew"
    csv_files = list(qcew_dir.rglob("*.csv"))

    chunks = []
    for f in csv_files:
        try:
            chunk = pd.read_csv(f, dtype=str, low_memory=False)
            if "own_code" not in chunk.columns:
                continue
            # own_code: 1=federal, 2=state, 3=local, 5=private
            # agglvl_code 71 = county total by ownership
            govt = chunk[
                chunk["own_code"].str.strip().isin(["1", "2", "3"]) &
                (chunk["industry_code"].str.strip() == "10") &
                chunk["agglvl_code"].str.strip().isin(["71"])
            ]
            private = chunk[
                (chunk["own_code"].str.strip() == "5") &
                (chunk["industry_code"].str.strip() == "10") &
                chunk["agglvl_code"].str.strip().isin(["71"])
            ]
            if len(govt) > 0 or len(private) > 0:
                combined = pd.concat([govt, private])
                chunks.append(combined[[
                    "area_fips", "area_title", "own_code", "annual_avg_emplvl",
                ]])
        except Exception:
            continue

    df = pd.concat(chunks, ignore_index=True)
    df["county_fips"] = df["area_fips"].str.strip()
    df["employment"] = pd.to_numeric(df["annual_avg_emplvl"], errors="coerce").fillna(0)
    df["own_code"] = df["own_code"].str.strip()

    # Filter valid counties
    df = df[
        df["county_fips"].str.match(r"^\d{5}$") &
        ~df["county_fips"].str.startswith("00") &
        ~df["county_fips"].str.endswith("999") &
        ~df["county_fips"].str.startswith("72")
    ]

    # Pivot: county × ownership type
    pivoted = df.pivot_table(
        index=["county_fips", "area_title"],
        columns="own_code",
        values="employment",
        aggfunc="sum",
    ).fillna(0).reset_index()

    pivoted.columns.name = None
    rename = {"1": "federal_emp", "2": "state_emp", "3": "local_emp", "5": "private_emp"}
    pivoted = pivoted.rename(columns=rename)

    for col in rename.values():
        if col not in pivoted.columns:
            pivoted[col] = 0

    pivoted["govt_emp"] = pivoted["federal_emp"] + pivoted["state_emp"] + pivoted["local_emp"]
    pivoted["total_emp"] = pivoted["govt_emp"] + pivoted["private_emp"]
    pivoted["govt_pct"] = pivoted["govt_emp"] / pivoted["total_emp"].clip(lower=1)
    pivoted["federal_pct"] = pivoted["federal_emp"] / pivoted["total_emp"].clip(lower=1)

    print(f"  Government employment for {len(pivoted)} counties")
    return pivoted


def _load_transfer_payments():
    """Load Census ACS transfer payment data."""
    path = RAW_DIR / "census_transfers.json"
    if not path.exists():
        raise FileNotFoundError(f"Census transfer data not found at {path}")

    with open(path) as f:
        data = json.load(f)

    records = []
    for row in data[1:]:
        try:
            fips = row[6].zfill(2) + row[7].zfill(3)
            ss_hh = int(row[1]) if row[1] and row[1] != "null" else 0
            ssi_hh = int(row[2]) if row[2] and row[2] != "null" else 0
            pa_hh = int(row[3]) if row[3] and row[3] != "null" else 0
            ret_hh = int(row[4]) if row[4] and row[4] != "null" else 0
            total_hh = int(row[5]) if row[5] and row[5] != "null" else 1
        except (ValueError, IndexError):
            continue

        if total_hh > 0:
            records.append({
                "county_fips": fips,
                "ss_pct": ss_hh / total_hh,
                "ssi_pct": ssi_hh / total_hh,
                "pa_pct": pa_hh / total_hh,
                "retirement_pct": ret_hh / total_hh,
                "total_households": total_hh,
                "transfer_households": ss_hh + ssi_hh + pa_hh,
                "transfer_pct": (ss_hh + ssi_hh + pa_hh) / total_hh,
            })

    return pd.DataFrame(records)


def compute_government_floor():
    """
    Compute Dynamic 5 government floor scores for all counties.

    Returns DataFrame:
        county_fips, county_name,
        govt_emp_pct, federal_emp_pct, govt_emp_total,
        transfer_dependency, ss_pct, ssi_pct,
        govt_floor_score — composite insulation from government presence (0-1)
    """
    print("Computing government floor scores...")

    govt = _load_government_employment()
    transfers = _load_transfer_payments()

    # Merge
    df = govt.merge(transfers, on="county_fips", how="left")

    # Fill missing transfer data with median
    for col in ["transfer_pct", "ss_pct", "ssi_pct", "pa_pct", "retirement_pct"]:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median())

    # Government floor score components:

    # 1. Government employment concentration (0-1)
    # Typical range: 5-40% government employment
    df["govt_emp_score"] = ((df["govt_pct"] - 0.05) / 0.35).clip(0, 1)

    # 2. Federal employment (extra stable — insulated from state budget cycles)
    df["federal_score"] = (df["federal_pct"] / 0.10).clip(0, 1)

    # 3. Transfer payment dependency
    # High transfers = consumer spending has government floor
    # Typical range: 20-80% of households receiving some transfer
    df["transfer_score"] = ((df["transfer_pct"] - 0.20) / 0.60).clip(0, 1)

    # 4. Composite government floor
    df["govt_floor_score"] = (
        df["govt_emp_score"] * 0.45 +
        df["federal_score"] * 0.25 +
        df["transfer_score"] * 0.30
    ).clip(0, 1).round(3)

    # Transfer dependency detail for display
    df["transfer_dependency_label"] = df["transfer_pct"].apply(
        lambda x: "Very High" if x > 0.60 else
                  "High" if x > 0.45 else
                  "Moderate" if x > 0.30 else "Low"
    )

    print(f"  Government floor scores for {len(df)} counties")
    print(f"  Range: [{df['govt_floor_score'].min():.3f}, {df['govt_floor_score'].max():.3f}]")
    print(f"  Mean: {df['govt_floor_score'].mean():.3f}")

    result = df[[
        "county_fips", "area_title",
        "total_emp", "govt_emp", "private_emp",
        "federal_emp", "state_emp", "local_emp",
        "govt_pct", "federal_pct",
        "transfer_pct", "ss_pct", "ssi_pct", "pa_pct", "retirement_pct",
        "total_households",
        "govt_floor_score", "transfer_dependency_label",
    ]].rename(columns={"area_title": "county_name"})

    return result


def simulate_deficit_scenarios(year=2030, feedback_aggressiveness=0.5):
    """
    Dynamic 6: Corporate profit surge vs deficit spiral.

    Sub-A — Corporate profit surge (10x):
        AI productivity → corporate profit boom → higher tax revenue at current
        rates → government can fund displaced workers → floor holds longer.

    Sub-B — Deficit spiral:
        Displacement outpaces profit growth → deficits rise → Treasury yields
        rise → crowds out private investment → slower growth → more displacement.

    Returns dict with both scenarios and probability weights.
    """
    # Time intensity
    if year <= 2027:
        t = 0.2
    elif year <= 2030:
        t = 0.5
    elif year <= 2035:
        t = 0.8
    else:
        t = 1.0

    # CBO baseline: ~6% deficit/GDP, growing
    baseline_deficit_pct = 6.0 + (year - 2025) * 0.3  # Growing ~0.3%/yr

    # Sub-A: Corporate Profit Surge
    # AI productivity gains drive profit margins from ~12% to ~18%+
    # Corporate tax revenue as % of GDP rises from ~1.5% to ~3%
    profit_growth_mult = 1.0 + 2.0 * t * feedback_aggressiveness  # Up to 3x
    tax_revenue_boost = 0.015 * profit_growth_mult * t  # % of GDP
    deficit_a = max(2.0, baseline_deficit_pct - tax_revenue_boost * 100)
    gdp_boost_a = 0.005 * profit_growth_mult * t  # Productivity gains

    scenario_a = {
        "name": "Corporate Profit Surge",
        "label": "Your dad's scenario — AI drives 10x profit growth",
        "corporate_profit_growth": f"{profit_growth_mult:.1f}x",
        "tax_revenue_boost_gdp_pct": round(tax_revenue_boost * 100, 2),
        "deficit_gdp_pct": round(deficit_a, 1),
        "gdp_modifier": round(1.0 + gdp_boost_a, 4),
        "unemployment_modifier": round(1.0 - gdp_boost_a * 0.3, 4),
        "govt_floor_holds": deficit_a < 8.0,
        "floor_strength": min(1.0, max(0.0, 1.0 - (deficit_a - 4) / 8)),
        "yields_10yr_est": round(4.0 + max(0, deficit_a - 6) * 0.1, 1),
    }

    # Sub-B: Deficit Spiral
    # Displacement outpaces profit growth
    # Higher unemployment → higher transfer payments → higher deficits
    displacement_cost = 0.02 * t * (1 + feedback_aggressiveness)  # % of GDP
    deficit_b = baseline_deficit_pct + displacement_cost * 100
    yield_premium = max(0, (deficit_b - 6) * 0.15)  # Higher yields from more borrowing
    crowding_out = yield_premium * 0.003  # Private investment reduction
    gdp_drag = -crowding_out - 0.003 * t * feedback_aggressiveness

    scenario_b = {
        "name": "Deficit Spiral",
        "label": "Displacement outpaces profit growth — fiscal unsustainable",
        "displacement_fiscal_cost_pct": round(displacement_cost * 100, 2),
        "deficit_gdp_pct": round(deficit_b, 1),
        "gdp_modifier": round(max(0.95, 1.0 + gdp_drag), 4),
        "unemployment_modifier": round(1.0 + 0.015 * t * (1 + feedback_aggressiveness), 4),
        "govt_floor_holds": deficit_b < 10.0,
        "floor_strength": min(1.0, max(0.0, 1.0 - (deficit_b - 4) / 8)),
        "yields_10yr_est": round(4.0 + yield_premium, 1),
    }

    # Probability weighting
    # At low feedback aggressiveness: 60% profit surge, 40% deficit spiral
    # At high: reverses
    prob_a = max(0.20, 0.60 - feedback_aggressiveness * 0.40)
    prob_b = 1.0 - prob_a

    return {
        "year": year,
        "feedback_aggressiveness": feedback_aggressiveness,
        "baseline_deficit_pct": round(baseline_deficit_pct, 1),
        "scenario_a": scenario_a,
        "scenario_b": scenario_b,
        "probability_a": round(prob_a, 2),
        "probability_b": round(prob_b, 2),
        "warning": (
            "Both scenarios are simplified models of complex fiscal dynamics. "
            "Actual outcomes depend on Congressional action, Fed policy, global "
            "capital flows, and AI adoption speed — all deeply uncertain."
        ),
    }


def write_govt_floor_to_sqlite(df):
    """Write government floor scores to database."""
    conn = sqlite3.connect(DB_PATH)
    df.to_sql("county_govt_floor", conn, if_exists="replace", index=False)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_govt_fips ON county_govt_floor(county_fips)")
    conn.commit()
    conn.close()
    print(f"  Written {len(df)} county government floor scores to database")


def show_county_govt(fips, df):
    """Print government floor detail for a county."""
    row = df[df["county_fips"] == fips]
    if row.empty:
        print(f"  County {fips} not found")
        return
    r = row.iloc[0]

    print(f"\n  {'=' * 60}")
    print(f"  {r['county_name']} ({fips})")
    print(f"  {'=' * 60}")
    print(f"\n  --- DYNAMIC 5: Government Demand Floor ---")
    print(f"  Total employment:       {r['total_emp']:>10,.0f}")
    print(f"  Government employment:  {r['govt_emp']:>10,.0f} ({r['govt_pct']*100:.1f}%)")
    print(f"    Federal:              {r['federal_emp']:>10,.0f} ({r['federal_pct']*100:.1f}%)")
    print(f"    State:                {r['state_emp']:>10,.0f}")
    print(f"    Local:                {r['local_emp']:>10,.0f}")
    print(f"  Private employment:     {r['private_emp']:>10,.0f}")
    print(f"\n  Transfer Payment Dependency:")
    print(f"    Households receiving SS:    {r['ss_pct']*100:>5.1f}%")
    print(f"    Households receiving SSI:   {r['ssi_pct']*100:>5.1f}%")
    print(f"    Households receiving PA:    {r['pa_pct']*100:>5.1f}%")
    print(f"    Households w/ retirement:   {r['retirement_pct']*100:>5.1f}%")
    print(f"    Combined transfer dep:      {r['transfer_pct']*100:>5.1f}% ({r['transfer_dependency_label']})")
    print(f"\n  Government Floor Score:       {r['govt_floor_score']:.3f}")

    if r['govt_floor_score'] > 0.6:
        print(f"\n  Assessment: STRONG government floor — high government employment")
        print(f"  and/or transfer payment dependency creates significant demand")
        print(f"  insulation. Displacement cascade is dampened by ~{r['govt_floor_score']*40:.0f}%.")
    elif r['govt_floor_score'] > 0.3:
        print(f"\n  Assessment: MODERATE government floor — some insulation from")
        print(f"  government presence. Displacement cascade dampened ~{r['govt_floor_score']*40:.0f}%.")
    else:
        print(f"\n  Assessment: WEAK government floor — economy primarily private-sector")
        print(f"  dependent. Minimal dampening of displacement cascade.")


def show_deficit_comparison(year=2030, feedback=0.5):
    """Show both deficit scenarios side by side."""
    result = simulate_deficit_scenarios(year, feedback)
    a = result["scenario_a"]
    b = result["scenario_b"]

    print(f"\n  {'=' * 70}")
    print(f"  DYNAMIC 6: Fiscal Scenarios — Year {year}")
    print(f"  Feedback aggressiveness: {feedback}")
    print(f"  {'=' * 70}")

    print(f"\n  {'Metric':<35} {'Profit Surge':>17} {'Deficit Spiral':>17}")
    print(f"  {'-' * 70}")
    print(f"  {'Probability weight':<35} {result['probability_a']:>16.0%} {result['probability_b']:>16.0%}")
    print(f"  {'Deficit (% of GDP)':<35} {a['deficit_gdp_pct']:>16.1f}% {b['deficit_gdp_pct']:>16.1f}%")
    print(f"  {'GDP modifier':<35} {a['gdp_modifier']:>16.4f}x {b['gdp_modifier']:>16.4f}x")
    print(f"  {'Unemployment modifier':<35} {a['unemployment_modifier']:>16.4f}x {b['unemployment_modifier']:>16.4f}x")
    print(f"  {'10yr Treasury yield (est)':<35} {a['yields_10yr_est']:>15.1f}% {b['yields_10yr_est']:>15.1f}%")
    print(f"  {'Government floor holds?':<35} {'YES':>16} {'YES' if b['govt_floor_holds'] else 'BREAKING':>16}")
    print(f"  {'Floor strength':<35} {a['floor_strength']:>16.2f} {b['floor_strength']:>16.2f}")

    if 'corporate_profit_growth' in a:
        print(f"\n  Profit Surge: {a['label']}")
        print(f"    Corporate profit growth: {a['corporate_profit_growth']}")
        print(f"    Tax revenue boost: +{a['tax_revenue_boost_gdp_pct']:.1f}% of GDP")

    print(f"\n  Deficit Spiral: {b['label']}")
    print(f"    Displacement fiscal cost: +{b['displacement_fiscal_cost_pct']:.1f}% of GDP")
    if not b['govt_floor_holds']:
        print(f"    WARNING: Government floor is breaking — deficit unsustainable")

    # Time horizon
    print(f"\n  --- Deficit Path Over Time (feedback={feedback}) ---")
    print(f"  {'Year':<6} {'Baseline':>9} {'Surge':>9} {'Spiral':>9} {'Surge floor':>12} {'Spiral floor':>13}")
    print(f"  {'-' * 60}")
    for y in [2025, 2028, 2030, 2033, 2037]:
        r = simulate_deficit_scenarios(y, feedback)
        print(f"  {y:<6} {r['baseline_deficit_pct']:>8.1f}% {r['scenario_a']['deficit_gdp_pct']:>8.1f}% "
              f"{r['scenario_b']['deficit_gdp_pct']:>8.1f}% "
              f"{'HOLDS' if r['scenario_a']['govt_floor_holds'] else 'BREAKS':>11} "
              f"{'HOLDS' if r['scenario_b']['govt_floor_holds'] else 'BREAKS':>12}")

    print(f"\n  {result['warning']}")


if __name__ == "__main__":
    df = compute_government_floor()
    write_govt_floor_to_sqlite(df)

    # 1. High government county: Cumberland NC (Fort Liberty)
    print("\n\n=== HIGH GOVERNMENT COUNTY: Cumberland County, NC (Fort Liberty) ===")
    show_county_govt("37051", df)

    # 2. Contrast: similar-sized private-sector county
    print("\n\n=== PRIVATE SECTOR COUNTY: Macomb County, MI ===")
    show_county_govt("26099", df)

    # 3. High transfer dependency: Owsley County, KY (Appalachia)
    print("\n\n=== HIGH TRANSFER DEPENDENCY: Owsley County, KY (Appalachia) ===")
    show_county_govt("21189", df)

    # 4. Deficit scenarios
    print("\n\n=== DYNAMIC 6: DEFICIT SCENARIOS ===")
    show_deficit_comparison(year=2030, feedback=0.5)
