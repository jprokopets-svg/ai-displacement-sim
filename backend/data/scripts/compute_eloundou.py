"""
Compute AI Occupational Exposure from Eloundou et al. 2024 GPT-4 β scores.

Source: "GPTs are GPTs: Labor Market Impact Potential of Large Language Models"
        Eloundou, Manning, Mishkin, Rock (Science 384, 1306-1308, 2024)
        arXiv:2303.10130
        Data: https://github.com/openai/GPTs-are-GPTs/blob/main/data/occ_level.csv

METHODOLOGY:
    Eloundou et al. use a rubric-based approach where both human annotators
    and GPT-4 itself rate each occupation's tasks for LLM exposure. The β
    measure combines two exposure levels:

        β = E1 + 0.5 × E2

    where:
        E1 = fraction of tasks directly exposed to LLMs
        E2 = fraction of tasks exposed to LLM-powered tools/systems

    The GPT-4 ratings (dv_rating_beta) are used as the primary measure.
    These correlate well with human annotations but have broader coverage.

    Values are already on a [0, 1] scale representing the fraction of an
    occupation's tasks exposed to LLMs at the β threshold.

COMPARISON WITH FELTEN-RAJ-SEAMANS (2021):
    - FRS: ability-importance weighted overlap with AI applications (general AI)
    - Eloundou: task-level LLM exposure rated by GPT-4 (LLM-specific)
    - Eloundou captures post-2020 LLM capabilities that FRS predates
    - Eloundou is purely cognitive/language — does not measure physical automation

SOC CODE HANDLING:
    Eloundou uses O*NET-SOC format (XX-XXXX.XX). We normalize to 6-digit
    BLS SOC (XX-XXXX) by averaging across detailed SOCs, same as compute_aioe.py.
"""
from __future__ import annotations

import re

import pandas as pd

from .config import RAW_DIR


def _normalize_soc(soc_code: str) -> str | None:
    """Normalize O*NET SOC (XX-XXXX.XX) to 6-digit BLS SOC (XX-XXXX)."""
    if pd.isna(soc_code):
        return None
    match = re.match(r"(\d{2}-\d{4})", str(soc_code).strip())
    return match.group(1) if match else None


def compute_eloundou() -> pd.DataFrame:
    """
    Load Eloundou et al. 2024 GPT-4 β exposure scores.

    Returns:
        DataFrame with columns: [soc_code, occupation_title, ai_exposure]
        where ai_exposure is the GPT-4 β score (already 0-1 scaled).
    """
    print("Loading Eloundou et al. 2024 GPT-4 β exposure scores...")

    csv_path = RAW_DIR / "eloundou" / "occ_level.csv"
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Eloundou data not found at {csv_path}. "
            f"Run download step first."
        )

    df = pd.read_csv(csv_path)
    print(f"  Loaded {len(df)} occupation rows")

    # Extract the GPT-4 β score
    df = df.rename(columns={
        "O*NET-SOC Code": "onet_soc",
        "Title": "occupation_title",
        "dv_rating_beta": "beta_raw",
    })

    # Normalize SOC codes to 6-digit
    df["soc_code"] = df["onet_soc"].apply(_normalize_soc)

    # Some 6-digit SOCs have multiple O*NET detailed SOCs
    # Average across detailed SOCs to get one score per 6-digit SOC
    title_lookup = df.groupby("soc_code")["occupation_title"].first()

    occ_6digit = (
        df.groupby("soc_code")["beta_raw"]
        .mean()
        .reset_index()
    )
    occ_6digit["occupation_title"] = occ_6digit["soc_code"].map(title_lookup)

    # The beta scores are already on [0, 1] — no normalization needed.
    # However, we rename to ai_exposure for interface compatibility.
    occ_6digit["ai_exposure"] = occ_6digit["beta_raw"]

    print(f"\n  Computed exposure for {len(occ_6digit)} occupations (6-digit SOC)")
    print(f"  Beta range: [{occ_6digit['ai_exposure'].min():.4f}, "
          f"{occ_6digit['ai_exposure'].max():.4f}]")
    print(f"  Beta mean: {occ_6digit['ai_exposure'].mean():.4f}")

    # Validation: print top and bottom 10
    print(f"\n  Top 10 most LLM-exposed occupations:")
    top10 = occ_6digit.nlargest(10, "ai_exposure")
    for _, row in top10.iterrows():
        print(f"    {row['soc_code']} {row['occupation_title']}: "
              f"{row['ai_exposure']:.3f}")

    print(f"\n  Bottom 10 least LLM-exposed occupations:")
    bot10 = occ_6digit.nsmallest(10, "ai_exposure")
    for _, row in bot10.iterrows():
        print(f"    {row['soc_code']} {row['occupation_title']}: "
              f"{row['ai_exposure']:.3f}")

    result = occ_6digit[["soc_code", "occupation_title", "ai_exposure"]].copy()
    result = result.dropna(subset=["soc_code"])

    return result


if __name__ == "__main__":
    df = compute_eloundou()
    print(f"\nFinal output: {len(df)} occupations with Eloundou GPT-4 β scores")
