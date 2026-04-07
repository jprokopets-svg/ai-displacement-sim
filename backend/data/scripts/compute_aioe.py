"""
Compute AI Occupational Exposure Index (AIOE) from O*NET Abilities data.

Implements the Felten, Raj, and Seamans (2021) methodology:
    "Occupational, Industry, and Geographic Exposure to Artificial Intelligence:
     A Novel Indicators, Revisited"

METHODOLOGY:
    The AIOE measures how much an occupation's required abilities overlap with
    the capabilities of current AI applications.

    For each occupation, O*NET rates the importance of 52 abilities on a 1-5
    scale (the "IM" scale — Importance). The Felten-Raj-Seamans paper maps
    each of these 52 abilities to an AI capability score reflecting how
    prevalent AI applications are that utilize that ability.

    The AIOE for occupation j is:

        AIOE(j) = Σ_a [ importance(j, a) × ai_score(a) ]
                  ─────────────────────────────────────────
                       Σ_a [ importance(j, a) ]

    where:
        - a indexes the 52 O*NET abilities
        - importance(j, a) is O*NET's importance rating (scale: 1-5)
        - ai_score(a) is the AI capability prevalence for ability a (scale: 0-1)

    This produces a weighted average: occupations that rely heavily on abilities
    where AI is strong (e.g., mathematical reasoning, pattern recognition) get
    high AIOE scores. Occupations relying on abilities where AI is weak (e.g.,
    manual dexterity, physical strength) get low scores.

    The raw AIOE is then normalized to [0, 1] across all occupations.

O*NET DATA USED:
    - Abilities.txt: columns [O*NET-SOC Code, Element ID, Element Name,
      Scale ID, Data Value, ...]
    - We use only rows where Scale ID = "IM" (Importance scale, 1-5)
    - Element IDs map to the 52 O*NET abilities (e.g., 1.A.1.a.1 = Oral Comprehension)

    - Occupation Data.txt: columns [O*NET-SOC Code, Title, Description]
    - Provides occupation titles for output

AI CAPABILITY SCORES:
    From Felten, Raj, Seamans (2021) Table 1, stored in config.py as
    FELTEN_AI_ABILITY_SCORES. These map each O*NET ability Element ID to a
    score reflecting how many AI applications utilize that ability.
    Abilities not in the table are assigned 0 (no known AI application overlap).

VALIDATION:
    Expected high-AIOE occupations: financial analysts, actuaries, statisticians,
    translators, technical writers — jobs heavy on cognitive/language abilities.

    Expected low-AIOE occupations: athletes, roofers, firefighters, dancers —
    jobs heavy on physical/psychomotor abilities.

    If the output doesn't match this pattern, something is wrong.
"""
from __future__ import annotations

import re

import pandas as pd
import numpy as np

from .config import RAW_DIR, FELTEN_AI_ABILITY_SCORES


def _normalize_soc(soc_code: str) -> str | None:
    """Normalize O*NET SOC (XX-XXXX.XX) to 6-digit BLS SOC (XX-XXXX)."""
    if pd.isna(soc_code):
        return None
    match = re.match(r"(\d{2}-\d{4})", str(soc_code).strip())
    return match.group(1) if match else None


def compute_aioe() -> pd.DataFrame:
    """
    Compute AI Occupational Exposure Index from O*NET Abilities data.

    Returns:
        DataFrame with columns: [soc_code, occupation_title, ai_exposure]
        where ai_exposure is normalized to [0, 1].
    """
    print("Computing AIOE from O*NET Abilities data...")

    # Load O*NET Abilities
    abilities_path = RAW_DIR / "onet" / "abilities.txt"
    if not abilities_path.exists():
        raise FileNotFoundError(
            f"O*NET Abilities data not found at {abilities_path}. "
            f"Run download step first."
        )

    abilities = pd.read_csv(abilities_path, sep="\t")
    print(f"  Loaded {len(abilities)} ability ratings")

    # Filter to Importance scale only (IM)
    abilities_im = abilities[abilities["Scale ID"] == "IM"].copy()
    print(f"  Filtered to {len(abilities_im)} importance ratings")

    # Load occupation titles
    occ_path = RAW_DIR / "onet" / "occupation_data.txt"
    occupations = pd.read_csv(occ_path, sep="\t")

    # Build title lookup (O*NET-SOC → Title)
    occ_titles = occupations.set_index("O*NET-SOC Code")["Title"].to_dict()

    # Map AI capability scores to each ability rating
    abilities_im["ai_score"] = abilities_im["Element ID"].map(FELTEN_AI_ABILITY_SCORES)

    # Count abilities with and without AI scores
    n_mapped = abilities_im["ai_score"].notna().sum()
    n_unmapped = abilities_im["ai_score"].isna().sum()
    print(f"  Ability ratings with AI score: {n_mapped}")
    print(f"  Ability ratings without AI score (assigned 0): {n_unmapped}")

    # Assign 0 to unmapped abilities (no known AI overlap)
    abilities_im["ai_score"] = abilities_im["ai_score"].fillna(0.0)

    # Compute AIOE per occupation
    # AIOE = Σ(importance × ai_score) / Σ(importance)
    def _compute_occ_aioe(group: pd.DataFrame) -> pd.Series:
        importance = group["Data Value"].values
        ai_scores = group["ai_score"].values

        total_importance = importance.sum()
        if total_importance == 0:
            return pd.Series({"aioe_raw": 0.0})

        weighted_sum = (importance * ai_scores).sum()
        aioe = weighted_sum / total_importance

        return pd.Series({"aioe_raw": aioe})

    occ_aioe = (
        abilities_im
        .groupby("O*NET-SOC Code")
        .apply(_compute_occ_aioe, include_groups=False)
        .reset_index()
    )

    # Add occupation titles
    occ_aioe["occupation_title"] = occ_aioe["O*NET-SOC Code"].map(occ_titles)

    # Normalize SOC codes to 6-digit for BLS matching
    occ_aioe["soc_code"] = occ_aioe["O*NET-SOC Code"].apply(_normalize_soc)

    # Some 6-digit SOCs have multiple O*NET detailed SOCs (e.g., 15-1252.00 and 15-1252.01)
    # Average across detailed SOCs to get one score per 6-digit SOC
    # Keep the first title as representative
    title_lookup = occ_aioe.groupby("soc_code")["occupation_title"].first()

    occ_6digit = (
        occ_aioe
        .groupby("soc_code")["aioe_raw"]
        .mean()
        .reset_index()
    )
    occ_6digit["occupation_title"] = occ_6digit["soc_code"].map(title_lookup)

    # Normalize to [0, 1]
    min_aioe = occ_6digit["aioe_raw"].min()
    max_aioe = occ_6digit["aioe_raw"].max()
    occ_6digit["ai_exposure"] = (
        (occ_6digit["aioe_raw"] - min_aioe) / (max_aioe - min_aioe)
    )

    print(f"\n  Computed AIOE for {len(occ_6digit)} occupations (6-digit SOC)")
    print(f"  Raw AIOE range: [{min_aioe:.4f}, {max_aioe:.4f}]")
    print(f"  Normalized range: [0.000, 1.000]")

    # Validation: print top and bottom 10
    print(f"\n  Top 10 most AI-exposed occupations:")
    top10 = occ_6digit.nlargest(10, "ai_exposure")
    for _, row in top10.iterrows():
        print(f"    {row['soc_code']} {row['occupation_title']}: "
              f"{row['ai_exposure']:.3f} (raw: {row['aioe_raw']:.4f})")

    print(f"\n  Bottom 10 least AI-exposed occupations:")
    bot10 = occ_6digit.nsmallest(10, "ai_exposure")
    for _, row in bot10.iterrows():
        print(f"    {row['soc_code']} {row['occupation_title']}: "
              f"{row['ai_exposure']:.3f} (raw: {row['aioe_raw']:.4f})")

    # Sanity check: cognitive jobs should be high, physical jobs should be low
    result = occ_6digit[["soc_code", "occupation_title", "ai_exposure"]].copy()
    result = result.dropna(subset=["soc_code"])

    return result


if __name__ == "__main__":
    df = compute_aioe()
    print(f"\nFinal output: {len(df)} occupations with AIOE scores")
