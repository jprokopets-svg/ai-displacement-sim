"""
Dynamic 3 — K-Shape Wealth Effect
Dynamic 4 — AI Equity Reflexive Loop

Dynamic 3 measures the divergence between equity holders (top economy)
and wage workers (bottom economy) at the county level.

Proxied by:
    - Gini coefficient (Census ACS B19083) — income inequality
    - Per capita income / median household income ratio — wealth concentration
    - Per capita income level — absolute wealth (more equity assets)

Counties with high equity concentration are more INSULATED short-term
(wealthy spending props up local economy) but more FRAGILE if the AI
equity narrative breaks (Dynamic 4 loop-break scenario).

Dynamic 4 models the AI equity reflexive loop:
    Loop intact: AI capex → tech earnings → equity prices → wealthy spending → GDP
    Loop breaks: AI disappoints → tech miss → equity fall → spending contracts → GDP drops

This is a SPECULATIVE scenario toggle that dramatically affects medium/long
term projections. Always labeled with uncertainty warning.

Data: Census ACS 2022 5-year estimates (B19301, B19013, B19083).
"""
from __future__ import annotations

import json
import sqlite3

import pandas as pd
import numpy as np

from .config import RAW_DIR, DB_PATH


def _load_census_income():
    """Load Census ACS income data by county."""
    path = RAW_DIR / "census_income.json"
    if not path.exists():
        raise FileNotFoundError(f"Census income data not found at {path}")

    with open(path) as f:
        data = json.load(f)

    header = data[0]
    rows = data[1:]

    records = []
    for row in rows:
        try:
            fips = row[6].zfill(2) + row[7].zfill(3)  # state + county
            pci = int(row[1]) if row[1] and row[1] != "null" else None
            median_hh = int(row[2]) if row[2] and row[2] != "null" else None
            gini = float(row[3]) if row[3] and row[3] != "null" else None
        except (ValueError, IndexError):
            continue

        if pci and median_hh and median_hh > 0:
            records.append({
                "county_fips": fips,
                "county_name": row[0],
                "per_capita_income": pci,
                "median_household_income": median_hh,
                "gini_coefficient": gini,
            })

    return pd.DataFrame(records)


def compute_kshape_scores():
    """
    Compute K-shape wealth effect scores for all counties.

    Returns DataFrame with:
        county_fips, county_name,
        per_capita_income, median_household_income, gini_coefficient,
        wealth_concentration_ratio — PCI / (median_HH / 2.5), normalized
        kshape_score — composite K-shape divergence (0-1)
        equity_insulation — short-term insulation from wealthy spending
        equity_fragility — vulnerability to AI equity narrative break
    """
    print("Computing K-shape wealth effect scores...")

    df = _load_census_income()
    print(f"  Loaded income data for {len(df)} counties")

    # Wealth concentration ratio:
    # Per capita income vs "per person" median (median / avg household size ~2.5)
    # If PCI >> per-person median, it means top earners are pulling the average up
    # = high concentration of capital/equity income
    df["per_person_median"] = df["median_household_income"] / 2.5
    df["wealth_ratio"] = df["per_capita_income"] / df["per_person_median"]

    # Normalize wealth ratio to 0-1 (range is roughly 0.8 to 2.5)
    wr_min, wr_max = df["wealth_ratio"].quantile(0.05), df["wealth_ratio"].quantile(0.95)
    df["wealth_concentration"] = (
        (df["wealth_ratio"] - wr_min) / (wr_max - wr_min)
    ).clip(0, 1)

    # Normalize Gini to 0-1 (typical range 0.35 to 0.60)
    gini_min, gini_max = 0.35, 0.60
    df["gini_normalized"] = (
        (df["gini_coefficient"].fillna(0.45) - gini_min) / (gini_max - gini_min)
    ).clip(0, 1)

    # Normalize PCI to 0-1 (proxy for absolute wealth / equity ownership)
    pci_min, pci_max = df["per_capita_income"].quantile(0.05), df["per_capita_income"].quantile(0.95)
    df["pci_normalized"] = (
        (df["per_capita_income"] - pci_min) / (pci_max - pci_min)
    ).clip(0, 1)

    # K-shape score: composite of inequality indicators
    df["kshape_score"] = (
        df["gini_normalized"] * 0.40 +
        df["wealth_concentration"] * 0.35 +
        df["pci_normalized"] * 0.25
    ).clip(0, 1).round(3)

    # Equity insulation: wealthy counties are buffered short-term
    # High PCI + high median = strong consumer base not dependent on wages alone
    df["equity_insulation"] = (
        df["pci_normalized"] * 0.60 +
        (df["median_household_income"] / 150000).clip(0, 1) * 0.40
    ).clip(0, 1).round(3)

    # Equity fragility: same wealthy counties are FRAGILE if equity loop breaks
    # High wealth concentration + high Gini = economy dependent on top earners
    # who are dependent on equity prices which are dependent on AI narrative
    df["equity_fragility"] = (
        df["wealth_concentration"] * 0.50 +
        df["gini_normalized"] * 0.30 +
        df["pci_normalized"] * 0.20
    ).clip(0, 1).round(3)

    # Equity-to-wage ratio (displayable metric)
    # Approximation: (PCI - per_person_median) / per_person_median
    # = fraction of income from non-wage sources (investment, capital gains)
    df["equity_wage_ratio"] = (
        (df["per_capita_income"] - df["per_person_median"]) / df["per_person_median"]
    ).clip(0, 5).round(2)

    print(f"  K-shape score range: [{df['kshape_score'].min():.3f}, {df['kshape_score'].max():.3f}]")
    print(f"  Mean: {df['kshape_score'].mean():.3f}")

    result = df[[
        "county_fips", "county_name",
        "per_capita_income", "median_household_income", "gini_coefficient",
        "wealth_ratio", "wealth_concentration",
        "kshape_score", "equity_insulation", "equity_fragility",
        "equity_wage_ratio",
    ]]

    return result


def simulate_equity_loop(loop_status="intact", year=2030, feedback_aggressiveness=0.5):
    """
    Dynamic 4: AI Equity Reflexive Loop simulation.

    Args:
        loop_status: 'intact' or 'breaks'
        year: projection year
        feedback_aggressiveness: 0-1 (0=Goldman gradual, 1=full cascade)

    Returns dict with macro impact multipliers:
        gdp_modifier — applied to GDP growth projections
        unemployment_modifier — applied to unemployment projections
        equity_wealth_modifier — how much equity wealth changes
        consumer_spending_modifier — downstream spending impact
        confidence_label — uncertainty label for UI
    """
    # Base case: 2% GDP growth, steady equity wealth
    result = {
        "loop_status": loop_status,
        "year": year,
        "feedback_aggressiveness": feedback_aggressiveness,
    }

    # Time scaling: loop effects intensify with time horizon
    if year <= 2027:
        time_intensity = 0.2  # Near term: minimal loop effects
    elif year <= 2030:
        time_intensity = 0.5
    elif year <= 2035:
        time_intensity = 0.8
    else:
        time_intensity = 1.0

    if loop_status == "intact":
        # AI capex → tech earnings → equity prices → wealthy spending → GDP
        # The virtuous cycle amplifies growth
        ai_productivity_gain = 0.005 * time_intensity  # +0.5% GDP at full intensity
        equity_appreciation = 0.08 * time_intensity  # 8% annual equity growth
        wealth_effect_spending = equity_appreciation * 0.04  # 4 cent wealth effect

        result["gdp_modifier"] = 1.0 + ai_productivity_gain + wealth_effect_spending
        result["unemployment_modifier"] = 1.0 - (ai_productivity_gain * 0.3)  # Some job creation
        result["equity_wealth_change_pct"] = equity_appreciation * 100
        result["consumer_spending_modifier"] = 1.0 + wealth_effect_spending
        result["confidence_label"] = "Base case — AI investment cycle continues"
        result["warning"] = None

    elif loop_status == "breaks":
        # AI capex disappoints → earnings miss → equity falls → spending contracts
        # Severity depends on feedback aggressiveness and time horizon
        severity = feedback_aggressiveness * time_intensity

        equity_decline = -0.25 * severity  # Up to -25% equity decline
        wealth_effect_drag = equity_decline * 0.04  # Wealth effect in reverse
        gdp_drag = wealth_effect_drag - 0.01 * severity  # + direct capex reduction
        unemployment_spike = 0.02 * severity  # +2% unemployment at max severity

        # Feedback loop: equity decline → less AI investment → less productivity →
        # lower earnings → more equity decline
        if feedback_aggressiveness > 0.5:
            feedback_multiplier = 1.0 + (feedback_aggressiveness - 0.5) * 0.6
            equity_decline *= feedback_multiplier
            gdp_drag *= feedback_multiplier
            unemployment_spike *= feedback_multiplier

        result["gdp_modifier"] = max(0.90, 1.0 + gdp_drag)
        result["unemployment_modifier"] = 1.0 + unemployment_spike
        result["equity_wealth_change_pct"] = equity_decline * 100
        result["consumer_spending_modifier"] = max(0.92, 1.0 + wealth_effect_drag)
        result["confidence_label"] = "SPECULATIVE — AI equity loop break scenario"
        result["warning"] = (
            "This is a tail risk scenario, not a base case. The AI equity loop break "
            "assumes AI capex disappoints relative to market expectations, triggering "
            "a reflexive decline in tech valuations and downstream spending. "
            "Probability and timing are highly uncertain."
        )

    return result


def write_kshape_to_sqlite(df):
    """Write K-shape scores to database."""
    conn = sqlite3.connect(DB_PATH)
    df.to_sql("county_kshape", conn, if_exists="replace", index=False)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_kshape_fips ON county_kshape(county_fips)")
    conn.commit()
    conn.close()
    print(f"  Written {len(df)} county K-shape scores to database")


def show_county_kshape(fips, df):
    """Print K-shape detail for a county."""
    row = df[df["county_fips"] == fips]
    if row.empty:
        print(f"  County {fips} not found")
        return
    r = row.iloc[0]

    print(f"\n  {'=' * 60}")
    print(f"  {r['county_name']} ({fips})")
    print(f"  {'=' * 60}")
    print(f"\n  --- DYNAMIC 3: K-Shape Wealth Effect ---")
    print(f"  Per capita income:           ${r['per_capita_income']:>8,}")
    print(f"  Median household income:     ${r['median_household_income']:>8,}")
    print(f"  Gini coefficient:            {r['gini_coefficient']:.3f}")
    print(f"  Equity-to-wage ratio:        {r['equity_wage_ratio']:.2f}x")
    print(f"  Wealth concentration:        {r['wealth_concentration']:.3f}")
    print(f"  K-shape score:               {r['kshape_score']:.3f}")
    print(f"  Equity insulation (short):   {r['equity_insulation']:.3f}")
    print(f"  Equity fragility (if break): {r['equity_fragility']:.3f}")

    # Interpretation
    if r["equity_insulation"] > 0.6:
        print(f"\n  Interpretation: High equity insulation — wealthy spending buffers")
        print(f"  local economy short-term. BUT high fragility ({r['equity_fragility']:.2f})")
        print(f"  if AI equity narrative breaks.")
    elif r["equity_insulation"] < 0.3:
        print(f"\n  Interpretation: Low equity insulation — wage-dependent economy.")
        print(f"  More exposed to displacement but less exposed to equity loop break.")


def show_equity_loop_comparison(year=2030, feedback=0.5):
    """Show simulation results: loop intact vs loop breaks."""
    intact = simulate_equity_loop("intact", year, feedback)
    breaks = simulate_equity_loop("breaks", year, feedback)

    print(f"\n  {'=' * 70}")
    print(f"  DYNAMIC 4: AI Equity Reflexive Loop — Year {year}")
    print(f"  Feedback aggressiveness: {feedback:.1f}/1.0")
    print(f"  {'=' * 70}")

    print(f"\n  {'Metric':<35} {'Loop Intact':>15} {'Loop Breaks':>15}")
    print(f"  {'-' * 65}")
    print(f"  {'GDP modifier':<35} {intact['gdp_modifier']:>14.3f}x {breaks['gdp_modifier']:>14.3f}x")
    print(f"  {'Unemployment modifier':<35} {intact['unemployment_modifier']:>14.3f}x {breaks['unemployment_modifier']:>14.3f}x")
    print(f"  {'Equity wealth change':<35} {intact['equity_wealth_change_pct']:>+13.1f}% {breaks['equity_wealth_change_pct']:>+13.1f}%")
    print(f"  {'Consumer spending modifier':<35} {intact['consumer_spending_modifier']:>14.3f}x {breaks['consumer_spending_modifier']:>14.3f}x")

    print(f"\n  Loop intact label:  {intact['confidence_label']}")
    print(f"  Loop breaks label:  {breaks['confidence_label']}")
    if breaks["warning"]:
        print(f"\n  WARNING: {breaks['warning']}")

    # Show at different time horizons
    print(f"\n  --- Time Horizon Sensitivity (feedback={feedback}) ---")
    print(f"  {'Year':<8} {'GDP (intact)':>14} {'GDP (breaks)':>14} {'Gap':>10}")
    print(f"  {'-' * 48}")
    for y in [2027, 2030, 2033, 2037]:
        i = simulate_equity_loop("intact", y, feedback)
        b = simulate_equity_loop("breaks", y, feedback)
        gap = i["gdp_modifier"] - b["gdp_modifier"]
        print(f"  {y:<8} {i['gdp_modifier']:>13.3f}x {b['gdp_modifier']:>13.3f}x {gap:>+9.3f}")


if __name__ == "__main__":
    # Compute K-shape
    df = compute_kshape_scores()
    write_kshape_to_sqlite(df)

    # Show high-equity county (Fairfax VA = 51059)
    print("\n\n=== HIGH EQUITY COUNTY: Fairfax County, Virginia ===")
    show_county_kshape("51059", df)

    # Show low-equity county for contrast
    print("\n\n=== LOW EQUITY COUNTY: Macomb County, Michigan ===")
    show_county_kshape("26099", df)

    # Show equity loop comparison
    print("\n\n=== AI EQUITY LOOP COMPARISON ===")
    show_equity_loop_comparison(year=2030, feedback=0.5)
