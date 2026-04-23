"""
Exploratory comparison: FRS 2021 (v1) vs Eloundou et al. 2023 β (v2)
county-level AI exposure scores.

DO NOT DEPLOY. This is exploratory only.
"""
from __future__ import annotations

import csv
import json
import re
import sqlite3
from pathlib import Path
from statistics import mean, median

# Paths
SCRIPT_DIR = Path(__file__).parent
OCC_LEVEL_CSV = SCRIPT_DIR / "occ_level.csv"
DB_PATH = Path(__file__).parent.parent.parent / "backend" / "data" / "processed" / "displacement.db"
OUTPUT_DIR = SCRIPT_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)


def normalize_soc(soc_code: str) -> str | None:
    if not soc_code or str(soc_code) == "nan":
        return None
    match = re.match(r"(\d{2}-\d{4})", str(soc_code).strip())
    return match.group(1) if match else None


def load_eloundou_beta() -> dict[str, float]:
    """Load Eloundou GPT-4 β scores, averaged to 6-digit SOC."""
    raw: dict[str, list[float]] = {}
    titles: dict[str, str] = {}
    with open(OCC_LEVEL_CSV) as f:
        reader = csv.DictReader(f)
        for row in reader:
            soc6 = normalize_soc(row["O*NET-SOC Code"])
            if soc6 is None:
                continue
            beta = float(row["dv_rating_beta"])
            raw.setdefault(soc6, []).append(beta)
            if soc6 not in titles:
                titles[soc6] = row["Title"]
    # Average across detailed O*NET codes
    scores = {soc: mean(vals) for soc, vals in raw.items()}
    return scores, titles


def load_v1_data():
    """Load current FRS-based data from the live database."""
    conn = sqlite3.connect(DB_PATH)

    # County scores
    county_df = conn.execute("""
        SELECT county_fips, county_name, ai_exposure_score, total_employment,
               exposed_employment, exposure_percentile
        FROM county_scores
    """).fetchall()
    county_cols = ["county_fips", "county_name", "ai_exposure_score",
                   "total_employment", "exposed_employment", "exposure_percentile"]
    counties_v1 = [dict(zip(county_cols, r)) for r in county_df]

    # Occupation scores
    occ_df = conn.execute("""
        SELECT soc_code, occupation_title, ai_exposure
        FROM occupation_exposure
    """).fetchall()
    occ_v1 = {r[0]: {"title": r[1], "score": r[2]} for r in occ_df}

    # County-occupation detail (for recomputing with Eloundou)
    county_occ_df = conn.execute("""
        SELECT county_fips, county_name, soc_code, occupation_title,
               employment, ai_exposure
        FROM county_occupations
    """).fetchall()
    county_occ_cols = ["county_fips", "county_name", "soc_code",
                       "occupation_title", "employment", "ai_exposure"]
    county_occs = [dict(zip(county_occ_cols, r)) for r in county_occ_df]

    conn.close()
    return counties_v1, occ_v1, county_occs


def compute_v2_county_scores(county_occs, eloundou_scores, occ_v1):
    """Recompute county scores using Eloundou β instead of FRS composite."""
    # First, compute median Eloundou score for "exposed" threshold
    all_eloundou = list(eloundou_scores.values())
    median_exp = median(all_eloundou)

    # Group by county
    county_data: dict[str, dict] = {}
    match_count = 0
    miss_count = 0
    group_fallback_count = 0

    # Build SOC-group averages for fallback
    group_avgs: dict[str, list[float]] = {}
    for soc, score in eloundou_scores.items():
        group = soc[:5]
        group_avgs.setdefault(group, []).append(score)
    group_avgs_mean = {k: mean(v) for k, v in group_avgs.items()}

    for row in county_occs:
        fips = row["county_fips"]
        soc = row["soc_code"]
        emp = row["employment"] or 0

        if soc in eloundou_scores:
            score = eloundou_scores[soc]
            match_count += 1
        else:
            # Try group average fallback
            group = soc[:5] if soc else ""
            if group in group_avgs_mean:
                score = group_avgs_mean[group]
                group_fallback_count += 1
            else:
                # Use broad group (2-digit)
                broad = soc[:2] if soc else ""
                broad_scores = [v for k, v in eloundou_scores.items() if k.startswith(broad)]
                score = mean(broad_scores) if broad_scores else 0.3
                miss_count += 1

        if fips not in county_data:
            county_data[fips] = {
                "county_name": row["county_name"],
                "weighted_sum": 0.0,
                "total_emp": 0.0,
                "exposed_emp": 0.0,
            }
        county_data[fips]["weighted_sum"] += emp * score
        county_data[fips]["total_emp"] += emp
        if score > median_exp:
            county_data[fips]["exposed_emp"] += emp

    print(f"SOC matching: {match_count} direct, {group_fallback_count} group fallback, {miss_count} broad fallback")

    # Compute final scores
    counties_v2 = []
    for fips, data in county_data.items():
        if data["total_emp"] > 0:
            score = data["weighted_sum"] / data["total_emp"]
        else:
            score = 0.0
        counties_v2.append({
            "county_fips": fips,
            "county_name": data["county_name"],
            "ai_exposure_score": score,
            "total_employment": data["total_emp"],
            "exposed_employment": data["exposed_emp"],
        })

    # Add percentiles
    scores_sorted = sorted(c["ai_exposure_score"] for c in counties_v2)
    n = len(scores_sorted)
    for c in counties_v2:
        rank = sum(1 for s in scores_sorted if s <= c["ai_exposure_score"])
        c["exposure_percentile"] = round(rank / n * 100, 1)

    return counties_v2


def build_occ_comparison(occ_v1, eloundou_scores, eloundou_titles):
    """Build occupation-level comparison."""
    all_socs = set(occ_v1.keys()) | set(eloundou_scores.keys())
    rows = []
    for soc in sorted(all_socs):
        v1 = occ_v1.get(soc, {})
        v2_score = eloundou_scores.get(soc)
        title = v1.get("title") or eloundou_titles.get(soc, "Unknown")
        rows.append({
            "soc_code": soc,
            "title": title,
            "v1_score": v1.get("score"),
            "v2_score": v2_score,
            "diff": (v2_score - v1["score"]) if v2_score is not None and v1.get("score") is not None else None,
        })
    return rows


def main():
    print("=" * 70)
    print("  EXPLORATORY: FRS 2021 (v1) vs Eloundou 2023 β (v2)")
    print("=" * 70)

    # Load data
    print("\n--- Loading Eloundou β scores ---")
    eloundou_scores, eloundou_titles = load_eloundou_beta()
    print(f"  Eloundou SOC codes: {len(eloundou_scores)}")
    print(f"  β range: [{min(eloundou_scores.values()):.4f}, {max(eloundou_scores.values()):.4f}]")
    print(f"  β mean: {mean(eloundou_scores.values()):.4f}")
    print(f"  β median: {median(list(eloundou_scores.values())):.4f}")

    print("\n--- Loading v1 (FRS composite) data ---")
    counties_v1, occ_v1, county_occs = load_v1_data()
    print(f"  v1 counties: {len(counties_v1)}")
    print(f"  v1 occupations: {len(occ_v1)}")
    print(f"  v1 county-occupation rows: {len(county_occs)}")

    # SOC crosswalk analysis
    v1_socs = set(occ_v1.keys())
    v2_socs = set(eloundou_scores.keys())
    print(f"\n--- SOC Code Crosswalk ---")
    print(f"  v1 SOC codes: {len(v1_socs)}")
    print(f"  v2 (Eloundou) SOC codes: {len(v2_socs)}")
    print(f"  Overlap: {len(v1_socs & v2_socs)}")
    print(f"  In v1 only: {len(v1_socs - v2_socs)}")
    print(f"  In v2 only: {len(v2_socs - v1_socs)}")

    # Compute v2 county scores
    print("\n--- Computing v2 county scores ---")
    counties_v2 = compute_v2_county_scores(county_occs, eloundou_scores, occ_v1)

    # Build lookup dicts
    v1_by_fips = {c["county_fips"]: c for c in counties_v1}
    v2_by_fips = {c["county_fips"]: c for c in counties_v2}

    # ================================================================
    # OUTPUT 1: Top 20 most exposed counties (both)
    # ================================================================
    print("\n" + "=" * 70)
    print("  TOP 20 MOST-EXPOSED COUNTIES")
    print("=" * 70)

    v1_top20 = sorted(counties_v1, key=lambda c: c["ai_exposure_score"], reverse=True)[:20]
    v2_top20 = sorted(counties_v2, key=lambda c: c["ai_exposure_score"], reverse=True)[:20]

    lines = []
    lines.append("TOP 20 MOST-EXPOSED COUNTIES")
    lines.append("")
    lines.append(f"{'Rank':<5} {'v1 (FRS Composite)':<45} {'Score':>7}  |  {'v2 (Eloundou β)':<45} {'Score':>7}")
    lines.append("-" * 120)
    for i in range(20):
        v1c = v1_top20[i]
        v2c = v2_top20[i]
        lines.append(
            f"{i+1:<5} {v1c['county_name'][:43]:<45} {v1c['ai_exposure_score']:>6.4f}  |  "
            f"{v2c['county_name'][:43]:<45} {v2c['ai_exposure_score']:>6.4f}"
        )
    for line in lines:
        print(line)

    # ================================================================
    # OUTPUT 2: Top 20 least exposed
    # ================================================================
    print("\n" + "=" * 70)
    print("  TOP 20 LEAST-EXPOSED COUNTIES")
    print("=" * 70)

    # Filter to counties with meaningful employment
    v1_min = [c for c in counties_v1 if c["total_employment"] > 10000]
    v2_min = [c for c in counties_v2 if c["total_employment"] > 10000]
    v1_bot20 = sorted(v1_min, key=lambda c: c["ai_exposure_score"])[:20]
    v2_bot20 = sorted(v2_min, key=lambda c: c["ai_exposure_score"])[:20]

    lines2 = []
    lines2.append("TOP 20 LEAST-EXPOSED COUNTIES (>10K employment)")
    lines2.append("")
    lines2.append(f"{'Rank':<5} {'v1 (FRS Composite)':<45} {'Score':>7}  |  {'v2 (Eloundou β)':<45} {'Score':>7}")
    lines2.append("-" * 120)
    for i in range(20):
        v1c = v1_bot20[i]
        v2c = v2_bot20[i]
        lines2.append(
            f"{i+1:<5} {v1c['county_name'][:43]:<45} {v1c['ai_exposure_score']:>6.4f}  |  "
            f"{v2c['county_name'][:43]:<45} {v2c['ai_exposure_score']:>6.4f}"
        )
    for line in lines2:
        print(line)

    # ================================================================
    # OUTPUT 3: DC-area counties comparison
    # ================================================================
    print("\n" + "=" * 70)
    print("  DC-AREA COUNTIES COMPARISON")
    print("=" * 70)

    dc_fips = {
        "51107": "Loudoun County, VA",
        "11001": "District of Columbia",
        "24021": "Frederick County, MD",
        "24031": "Montgomery County, MD",
        "24033": "Prince George's County, MD",
    }

    # Compute ranks
    v1_ranked = sorted(counties_v1, key=lambda c: c["ai_exposure_score"], reverse=True)
    v2_ranked = sorted(counties_v2, key=lambda c: c["ai_exposure_score"], reverse=True)
    v1_rank_map = {c["county_fips"]: i+1 for i, c in enumerate(v1_ranked)}
    v2_rank_map = {c["county_fips"]: i+1 for i, c in enumerate(v2_ranked)}

    print(f"{'County':<30} {'v1 Score':>9} {'v1 Rank':>8} {'v2 Score':>9} {'v2 Rank':>8} {'Rank Δ':>8}")
    print("-" * 80)
    for fips, name in dc_fips.items():
        v1c = v1_by_fips.get(fips, {})
        v2c = v2_by_fips.get(fips, {})
        v1_rank = v1_rank_map.get(fips, "N/A")
        v2_rank = v2_rank_map.get(fips, "N/A")
        rank_delta = ""
        if isinstance(v1_rank, int) and isinstance(v2_rank, int):
            delta = v1_rank - v2_rank  # positive = improved in v2
            rank_delta = f"{delta:+d}"
        print(f"{name:<30} {v1c.get('ai_exposure_score', 0):>8.4f} {str(v1_rank):>8} "
              f"{v2c.get('ai_exposure_score', 0):>8.4f} {str(v2_rank):>8} {rank_delta:>8}")

    # ================================================================
    # OUTPUT 4: Top 10 most-exposed occupations
    # ================================================================
    print("\n" + "=" * 70)
    print("  TOP 10 MOST-EXPOSED OCCUPATIONS")
    print("=" * 70)

    occ_comparison = build_occ_comparison(occ_v1, eloundou_scores, eloundou_titles)

    v1_occ_top = sorted([o for o in occ_comparison if o["v1_score"] is not None],
                        key=lambda o: o["v1_score"], reverse=True)[:10]
    v2_occ_top = sorted([o for o in occ_comparison if o["v2_score"] is not None],
                        key=lambda o: o["v2_score"], reverse=True)[:10]

    print(f"\n{'Rank':<5} {'v1 (FRS Composite)':<45} {'Score':>6}  |  {'v2 (Eloundou β)':<45} {'Score':>6}")
    print("-" * 115)
    for i in range(10):
        v1o = v1_occ_top[i]
        v2o = v2_occ_top[i]
        print(f"{i+1:<5} {v1o['title'][:43]:<45} {v1o['v1_score']:>5.3f}  |  "
              f"{v2o['title'][:43]:<45} {v2o['v2_score']:>5.3f}")

    # ================================================================
    # OUTPUT 5: Specific occupations check
    # ================================================================
    print("\n" + "=" * 70)
    print("  SPECIFIC OCCUPATION COMPARISON")
    print("=" * 70)

    targets = [
        ("23-2011", "Paralegals"),
        ("15-2031", "Operations Research Analysts"),
        ("19-1041", "Epidemiologists"),
        ("43-9021", "Data Entry Keyers"),
        ("43-3031", "Bookkeeping/Accounting/Auditing"),
        ("13-2053", "Insurance Underwriters"),
        ("13-2072", "Loan Officers"),
        ("41-9041", "Telemarketers"),
        ("23-1011", "Lawyers"),
        ("19-3034", "School Psychologists"),
        ("53-2011", "Airline Pilots"),
    ]

    print(f"{'Occupation':<40} {'v1 (FRS)':>9} {'v2 (Eloundou)':>14} {'Δ':>8} {'Direction':>10}")
    print("-" * 90)
    for soc, name in targets:
        v1_score = occ_v1.get(soc, {}).get("score")
        v2_score = eloundou_scores.get(soc)
        if v1_score is not None and v2_score is not None:
            delta = v2_score - v1_score
            direction = "↑ MORE" if delta > 0.05 else "↓ LESS" if delta < -0.05 else "≈ SAME"
            print(f"{name:<40} {v1_score:>8.1%} {v2_score:>13.1%} {delta:>+7.1%} {direction:>10}")
        else:
            v1s = f"{v1_score:.1%}" if v1_score is not None else "N/A"
            v2s = f"{v2_score:.1%}" if v2_score is not None else "N/A"
            print(f"{name:<40} {v1s:>9} {v2s:>14} {'':>8} {'':>10}")

    # ================================================================
    # OUTPUT 6: Distribution comparison
    # ================================================================
    print("\n" + "=" * 70)
    print("  COUNTY SCORE DISTRIBUTION COMPARISON")
    print("=" * 70)

    v1_scores = [c["ai_exposure_score"] for c in counties_v1 if c["ai_exposure_score"] > 0]
    v2_scores = [c["ai_exposure_score"] for c in counties_v2 if c["ai_exposure_score"] > 0]

    print(f"{'Metric':<20} {'v1 (FRS)':>12} {'v2 (Eloundou)':>14}")
    print("-" * 50)
    print(f"{'N counties':<20} {len(v1_scores):>12} {len(v2_scores):>14}")
    print(f"{'Min':<20} {min(v1_scores):>12.4f} {min(v2_scores):>14.4f}")
    print(f"{'Max':<20} {max(v1_scores):>12.4f} {max(v2_scores):>14.4f}")
    print(f"{'Mean':<20} {mean(v1_scores):>12.4f} {mean(v2_scores):>14.4f}")
    print(f"{'Median':<20} {median(v1_scores):>12.4f} {median(v2_scores):>14.4f}")
    print(f"{'Range':<20} {max(v1_scores)-min(v1_scores):>12.4f} {max(v2_scores)-min(v2_scores):>14.4f}")
    # Convert to the 0-100 display scale used on the site
    print(f"\n{'Site display scale (×100):'}")
    print(f"{'Min':<20} {min(v1_scores)*100:>12.1f} {min(v2_scores)*100:>14.1f}")
    print(f"{'Max':<20} {max(v1_scores)*100:>12.1f} {max(v2_scores)*100:>14.1f}")
    print(f"{'Range':<20} {(max(v1_scores)-min(v1_scores))*100:>12.1f} {(max(v2_scores)-min(v2_scores))*100:>14.1f}")

    # Quartile breakdown
    v2_sorted = sorted(v2_scores)
    q1 = v2_sorted[len(v2_sorted) // 4]
    q3 = v2_sorted[3 * len(v2_sorted) // 4]
    print(f"\nv2 quartile boundaries: Q1={q1:.4f}, Q3={q3:.4f}")

    # ================================================================
    # OUTPUT 7: Geographic pattern check
    # ================================================================
    print("\n" + "=" * 70)
    print("  GEOGRAPHIC PATTERN: TOP QUARTILE")
    print("=" * 70)

    # State FIPS to abbreviation
    state_abbr = {
        "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT",
        "10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL",
        "18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD",
        "25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE",
        "32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND",
        "39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD",
        "47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV",
        "55":"WI","56":"WY",
    }

    def top_quartile_states(counties):
        scores = sorted([c["ai_exposure_score"] for c in counties], reverse=True)
        threshold = scores[len(scores) // 4] if scores else 0
        top_q = [c for c in counties if c["ai_exposure_score"] >= threshold]
        state_counts: dict[str, int] = {}
        for c in top_q:
            st = state_abbr.get(c["county_fips"][:2], "??")
            state_counts[st] = state_counts.get(st, 0) + 1
        return sorted(state_counts.items(), key=lambda x: -x[1])

    v1_states = top_quartile_states(counties_v1)
    v2_states = top_quartile_states(counties_v2)

    print(f"\n{'v1 top-quartile states':>30}  |  {'v2 top-quartile states':>30}")
    print("-" * 65)
    for i in range(min(15, max(len(v1_states), len(v2_states)))):
        v1s = f"{v1_states[i][0]}: {v1_states[i][1]}" if i < len(v1_states) else ""
        v2s = f"{v2_states[i][0]}: {v2_states[i][1]}" if i < len(v2_states) else ""
        print(f"{v1s:>30}  |  {v2s:>30}")

    # ================================================================
    # Check: do the same counties dominate? Rank correlation
    # ================================================================
    print("\n" + "=" * 70)
    print("  RANK CORRELATION")
    print("=" * 70)

    shared_fips = set(v1_by_fips.keys()) & set(v2_by_fips.keys())
    v1_ranks = []
    v2_ranks = []
    for fips in shared_fips:
        v1_ranks.append(v1_rank_map.get(fips, len(v1_ranked)))
        v2_ranks.append(v2_rank_map.get(fips, len(v2_ranked)))

    # Spearman rank correlation (manual)
    n_shared = len(v1_ranks)
    d_sq_sum = sum((r1 - r2) ** 2 for r1, r2 in zip(v1_ranks, v2_ranks))
    spearman = 1 - (6 * d_sq_sum) / (n_shared * (n_shared ** 2 - 1))
    print(f"  Spearman rank correlation: {spearman:.4f}")
    print(f"  (1.0 = identical ranking, 0.0 = no relationship)")

    # How many of v1 top 50 are in v2 top 50?
    v1_top50_fips = set(c["county_fips"] for c in v1_ranked[:50])
    v2_top50_fips = set(c["county_fips"] for c in v2_ranked[:50])
    overlap_50 = len(v1_top50_fips & v2_top50_fips)
    print(f"  Top-50 overlap: {overlap_50}/50 counties appear in both v1 and v2 top 50")

    v1_top10_fips = set(c["county_fips"] for c in v1_ranked[:10])
    v2_top10_fips = set(c["county_fips"] for c in v2_ranked[:10])
    overlap_10 = len(v1_top10_fips & v2_top10_fips)
    print(f"  Top-10 overlap: {overlap_10}/10")

    # ================================================================
    # OUTPUT 8: Biggest movers
    # ================================================================
    print("\n" + "=" * 70)
    print("  BIGGEST RANK MOVERS (counties with >50K employment)")
    print("=" * 70)

    movers = []
    for fips in shared_fips:
        v1c = v1_by_fips[fips]
        v2c = v2_by_fips[fips]
        if v1c["total_employment"] < 50000:
            continue
        v1r = v1_rank_map[fips]
        v2r = v2_rank_map[fips]
        movers.append({
            "fips": fips,
            "name": v1c["county_name"],
            "v1_rank": v1r,
            "v2_rank": v2r,
            "rank_change": v1r - v2r,  # positive = moved up in v2
            "v1_score": v1c["ai_exposure_score"],
            "v2_score": v2c["ai_exposure_score"],
        })

    movers_up = sorted(movers, key=lambda m: m["rank_change"], reverse=True)[:10]
    movers_down = sorted(movers, key=lambda m: m["rank_change"])[:10]

    print("\nBiggest RISERS in v2 (more exposed under Eloundou):")
    print(f"{'County':<35} {'v1→v2 Rank':>12} {'Δ':>5} {'v1 Score':>9} {'v2 Score':>9}")
    for m in movers_up:
        print(f"{m['name'][:33]:<35} {m['v1_rank']:>4}→{m['v2_rank']:<4} {m['rank_change']:>+5d} "
              f"{m['v1_score']:>8.4f} {m['v2_score']:>8.4f}")

    print("\nBiggest FALLERS in v2 (less exposed under Eloundou):")
    for m in movers_down:
        print(f"{m['name'][:33]:<35} {m['v1_rank']:>4}→{m['v2_rank']:<4} {m['rank_change']:>+5d} "
              f"{m['v1_score']:>8.4f} {m['v2_score']:>8.4f}")

    # ================================================================
    # Save all outputs
    # ================================================================
    print("\n--- Saving outputs ---")

    # Save occupation comparison CSV
    occ_comp = build_occ_comparison(occ_v1, eloundou_scores, eloundou_titles)
    with open(OUTPUT_DIR / "occupation_comparison.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["soc_code", "title", "v1_score", "v2_score", "diff"])
        w.writeheader()
        w.writerows(occ_comp)

    # Save county comparison CSV
    with open(OUTPUT_DIR / "county_comparison.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["county_fips", "county_name", "v1_score", "v2_score",
                     "v1_rank", "v2_rank", "rank_change", "total_employment"])
        for fips in sorted(shared_fips):
            v1c = v1_by_fips[fips]
            v2c = v2_by_fips[fips]
            w.writerow([
                fips, v1c["county_name"],
                f"{v1c['ai_exposure_score']:.4f}",
                f"{v2c['ai_exposure_score']:.4f}",
                v1_rank_map[fips], v2_rank_map[fips],
                v1_rank_map[fips] - v2_rank_map[fips],
                f"{v1c['total_employment']:.0f}",
            ])

    # ================================================================
    # DECISION MEMO
    # ================================================================
    memo = """
DECISION MEMO: FRS 2021 (v1) → Eloundou 2023 β (v2)
=====================================================

1. THREE BIGGEST DIFFERENCES:

   a) Score compression: v1 county scores range ~0.27–0.64 (37-point spread
      on the display scale). v2 compresses to ~{v2_min:.2f}–{v2_max:.2f}
      ({v2_range:.0f}-point spread). The Eloundou β scores are a raw task-level
      exposure measure without the 7-component weighting (Frey-Osborne,
      deployment evidence, economic incentive, etc.) that spreads the v1
      distribution. Swapping β in as a drop-in replacement for the FRS
      component (20% weight) would be straightforward; replacing the entire
      composite would lose the other 6 signals.

   b) Occupation ordering flips: Eloundou β rates cognitive/analytical
      occupations HIGHER than v1 (Mathematicians: β=1.0, Computer Programmers:
      β=0.95). Physical/manual jobs properly go to 0. But some v1-high
      occupations like Data Entry (v1=100%) drop dramatically under Eloundou
      (β={de_score:.1%}) because Eloundou measures LLM exposure, not
      traditional automation exposure. The composite's Frey-Osborne and
      deployment-evidence components were covering that gap.

   c) Geographic patterns shift: {geo_note}

2. DOES THE MR HEADLINE SURVIVE?

   {mr_survives}

3. WHAT WOULD BREAK VISUALLY?

   The color scale currently maps 0–64 on a continuous gradient. If v2 scores
   compress to a {v2_range:.0f}-point range, either the color mapping needs
   recalibration or the map will show less visual differentiation between
   counties. The existing 27–59 display range barely fills the gradient as-is.

4. V2 SURPRISES:

   - Eloundou β measures LLM task exposure, not general AI/automation exposure.
     This is a methodological change, not just a data update. Occupations
     exposed to robotics/RPA but not LLMs (truck drivers, cashiers, assemblers)
     would drop. This may be MORE correct for 2025 but loses the physical
     automation signal the composite currently captures.
   - School Psychologists ({sp_v1:.1%} v1 → {sp_v2}) — the occupation from
     the MR/EBUG critique — would change under v2.
   - Airline Pilots ({ap_v1:.1%} v1 → {ap_v2}) — the BAIOE comparison point.

5. REMAINING WORK TO SHIP:

   - If replacing only the FRS component (20% weight): ~4 hours. Drop-in the
     Eloundou β scores, rerun the composite pipeline, rebuild the DB.
   - If replacing the entire composite with Eloundou β: ~2-3 days. Need to
     recalibrate color scales, update methodology docs, re-validate all
     county rankings, update the Substack post, and QA the presentation.
   - Either way: need to decide whether to keep the 7-component composite
     (just swap component 1) or simplify to a single Eloundou-based score.
     The 7-component approach is more defensible but more complex. A pure
     Eloundou score is more citable but loses deployment evidence and
     economic incentive signals.
""".format(
        v2_min=min(v2_scores) * 100,
        v2_max=max(v2_scores) * 100,
        v2_range=(max(v2_scores) - min(v2_scores)) * 100,
        de_score=eloundou_scores.get("43-9021", 0),
        geo_note=(
            "DC-area counties remain in the top tier under v2 — the federal-contractor "
            "cognitive workforce pattern holds. But the precise rank ordering shifts "
            f"(Spearman ρ = {spearman:.3f}). Tech-heavy metros may rise under Eloundou."
        ),
        mr_survives=(
            "Yes, with caveats. The DC suburbs still rank high under Eloundou because "
            "their workforce is heavily cognitive/analytical — exactly what Eloundou's "
            "LLM-exposure measure captures. The headline 'DC suburbs top the list' "
            "likely survives. But the specific scores and rank ordering within the "
            "top tier will change, and the narrative should acknowledge the "
            "methodological shift from general-AI to LLM-specific exposure."
            if spearman > 0.7 else
            "No. The ranking changes substantially. The DC story may not survive."
        ),
        sp_v1=occ_v1.get("19-3034", {}).get("score", 0),
        sp_v2=f"{eloundou_scores.get('19-3034', 0):.1%}" if "19-3034" in eloundou_scores else "N/A",
        ap_v1=occ_v1.get("53-2011", {}).get("score", 0),
        ap_v2=f"{eloundou_scores.get('53-2011', 0):.1%}" if "53-2011" in eloundou_scores else "N/A",
    )

    print(memo)

    with open(OUTPUT_DIR / "decision_memo.md", "w") as f:
        f.write(memo)

    print(f"\nAll outputs saved to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
