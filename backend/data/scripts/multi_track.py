"""
Multi-Track AI Displacement Model.

Four displacement tracks plus regulatory friction modifier:

Track 1 — Cognitive AI (weight 20%)
    Existing composite: Felten-Raj-Rock + deployment evidence + task pipeline +
    output verifiability + economic incentive. Measures digital/intellectual
    automation risk.

Track 2 — Industrial Robotics (weight 15%)
    Physical automation: robot density by industry (IFR data), manufacturing
    automation scores, warehouse/logistics robotics deployment.
    Captures what cognitive AI models miss: physical task displacement.
    Key affected sectors: manufacturing, warehouse, agriculture, construction.

Track 3 — Agentic AI (weight 15%)
    Forward-looking: multi-step autonomous AI workflows.
    Derived from O*NET task complexity + current agentic deployment evidence.
    CONTRIBUTES ZERO before 2026, scales linearly to full weight by 2030.
    Always labeled 'Forward-looking — higher uncertainty' in UI.

Track 4 — Offshoring Acceleration (weight 10%)
    AI removes coordination friction that limited offshoring.
    BLS occupational tradability + World Bank labor cost differentials.
    Compounds with Track 1: high cognitive exposure + high tradability = max risk.

Modifier — Regulatory Friction (applied as multiplier)
    Union density + licensing requirements. Dampens all tracks.

Final: composite = (T1*0.20 + T2*0.15 + T3*0.15 + T4*0.10) * (1 - friction*0.40)
    + remaining weight distributed proportionally.
    Total track weight = 0.60, friction modifier absorbs remaining 0.40 implicitly
    through the multiplication.

Year-dependent behavior:
    - Track 3 (Agentic) = 0 before 2026, linear ramp to 2030
    - Track 2 (Robotics) increases under high tariff scenario
    - Track 4 (Offshoring) increases under free trade scenario
"""
from __future__ import annotations

import re
import sqlite3

import pandas as pd
import numpy as np

from .config import RAW_DIR, DB_PATH


def _normalize_soc(soc_code):
    if pd.isna(soc_code):
        return None
    match = re.match(r"(\d{2}-\d{4})", str(soc_code).strip())
    return match.group(1) if match else None


# ============================================================================
# Track 1 — Cognitive AI (existing composite, condensed to single score)
# ============================================================================
# Already computed in composite_score.py and stored in DB.
# We read it directly.


# ============================================================================
# Track 2 — Industrial Robotics
# ============================================================================
# Robot density and physical automation scores by SOC group.
# Sources:
#   - IFR World Robotics Report 2023: robot installations by industry
#   - MIT Work of the Future: robotics displacement estimates
#   - Oxford Economics: "How Robots Change the World" (2019)
#
# Scale 0-1: probability of physical/robotic automation within 10 years.

ROBOTICS_SCORES = {
    # Manufacturing — highest robotics exposure
    "51-2092": 0.85,  # Team Assemblers
    "51-4011": 0.80,  # CNC Machine Tool Operators
    "51-4121": 0.75,  # Welders, Cutters, Solderers
    "51-9061": 0.70,  # Inspectors, Testers, Sorters
    "51-1011": 0.45,  # First-Line Supervisors of Production Workers
    "51-2031": 0.80,  # Engine and Other Machine Assemblers
    "51-4041": 0.75,  # Machinists
    "51-9111": 0.65,  # Packaging and Filling Machine Operators

    # Warehouse / Logistics — high robotics (Amazon effect)
    "53-7062": 0.75,  # Laborers and Freight Movers
    "53-7051": 0.70,  # Industrial Truck Operators (forklifts)
    "43-5071": 0.55,  # Shipping/Receiving Clerks
    "43-5111": 0.50,  # Weighers, Measurers, Samplers

    # Transportation — autonomous vehicles
    "53-3032": 0.65,  # Heavy Truck Drivers
    "53-3033": 0.60,  # Light Truck Drivers
    "53-3041": 0.55,  # Taxi Drivers and Chauffeurs
    "53-3031": 0.40,  # Driver/Sales Workers

    # Agriculture — increasing automation
    "45-2092": 0.50,  # Farmworkers, Crop
    "45-2091": 0.45,  # Agricultural Equipment Operators
    "45-2093": 0.40,  # Farmworkers, Farm/Ranch Animals
    "45-1011": 0.30,  # First-Line Supervisors, Farming

    # Construction — limited but growing
    "47-2061": 0.25,  # Construction Laborers
    "47-2051": 0.20,  # Cement Masons
    "47-2111": 0.15,  # Electricians
    "47-2152": 0.20,  # Plumbers

    # Food Service — early stage
    "35-2014": 0.35,  # Cooks, Restaurant
    "35-3023": 0.40,  # Fast Food Workers
    "35-9011": 0.30,  # Dining Room Attendants

    # Healthcare — surgical/pharmacy robotics
    "29-2052": 0.30,  # Pharmacy Technicians
    "29-1215": 0.25,  # Surgeons (robotic-assisted)
    "31-1131": 0.15,  # Nursing Assistants
}

# SOC group defaults for occupations not specifically scored
ROBOTICS_GROUP_DEFAULTS = {
    "11": 0.05,  # Management
    "13": 0.03,  # Business/Financial
    "15": 0.02,  # Computer/Math
    "17": 0.08,  # Architecture/Engineering
    "19": 0.05,  # Science
    "21": 0.02,  # Community/Social
    "23": 0.01,  # Legal
    "25": 0.02,  # Education
    "27": 0.05,  # Arts/Design
    "29": 0.12,  # Healthcare Practitioners
    "31": 0.15,  # Healthcare Support
    "33": 0.08,  # Protective Service
    "35": 0.30,  # Food Preparation
    "37": 0.20,  # Building Maintenance
    "39": 0.10,  # Personal Care
    "41": 0.08,  # Sales
    "43": 0.05,  # Office/Admin
    "45": 0.40,  # Farming
    "47": 0.20,  # Construction
    "49": 0.15,  # Installation/Maintenance
    "51": 0.60,  # Production
    "53": 0.45,  # Transportation
}


# ============================================================================
# Track 3 — Agentic AI (forward-looking)
# ============================================================================
# Scores based on: multi-step autonomous workflow potential from O*NET tasks
# + current agentic deployment evidence.
# These scores represent FULL DEPLOYMENT potential (year 2030+).
# Before 2026: multiplied by 0. Linear ramp 2026-2030.

AGENTIC_AI_SCORES = {
    # Highest agentic potential: multi-step knowledge workflows
    "23-2011": 0.90,  # Paralegals — legal research + document assembly + filing
    "13-2082": 0.88,  # Tax Preparers — data gathering + calculation + filing
    "43-4051": 0.85,  # Customer Service — inquiry → diagnosis → resolution → follow-up
    "13-2011": 0.82,  # Accountants — reconciliation + audit + reporting chains
    "13-1071": 0.80,  # HR Specialists — screening → interview scheduling → onboarding
    "13-2051": 0.78,  # Financial Analysts — data gathering → modeling → report generation
    "15-1252": 0.75,  # Software Developers — spec → code → test → deploy (Devin-like)
    "15-1253": 0.80,  # QA Analysts — test planning → execution → bug reporting
    "43-6011": 0.75,  # Secretaries — scheduling + correspondence + document management
    "27-3031": 0.70,  # PR Specialists — research → draft → distribute → monitor
    "41-3021": 0.68,  # Insurance Sales — quote → underwrite → bind → service
    "13-1161": 0.72,  # Market Research — design → field → analyze → report

    # Medium agentic potential
    "11-1021": 0.45,  # General Managers — some workflow automation
    "15-1212": 0.55,  # Info Security — detect → investigate → contain → remediate
    "29-1141": 0.35,  # Nurses — triage + documentation (physical care blocks full agentic)
    "25-2021": 0.30,  # Teachers — lesson planning + grading (instruction requires human)
    "41-2031": 0.40,  # Retail Sales — recommendations + inventory + reorder

    # Low agentic potential (physical or deeply relational)
    "53-3032": 0.15,  # Truck Drivers — driving is one continuous task, not multi-step workflow
    "47-2061": 0.05,  # Construction — physical, site-dependent
    "33-3051": 0.10,  # Police — judgment-heavy, unpredictable
    "39-9011": 0.05,  # Childcare — relational, improvisational
    "29-1215": 0.20,  # Surgeons — physical precision, non-routine
}

AGENTIC_GROUP_DEFAULTS = {
    "11": 0.40,  # Management
    "13": 0.65,  # Business/Financial
    "15": 0.60,  # Computer/Math
    "17": 0.35,  # Architecture/Engineering
    "19": 0.40,  # Science
    "21": 0.25,  # Community/Social
    "23": 0.70,  # Legal
    "25": 0.30,  # Education
    "27": 0.45,  # Arts/Design
    "29": 0.30,  # Healthcare Practitioners
    "31": 0.20,  # Healthcare Support
    "33": 0.15,  # Protective Service
    "35": 0.25,  # Food Preparation
    "37": 0.10,  # Building Maintenance
    "39": 0.10,  # Personal Care
    "41": 0.40,  # Sales
    "43": 0.60,  # Office/Admin
    "45": 0.10,  # Farming
    "47": 0.08,  # Construction
    "49": 0.15,  # Installation/Maintenance
    "51": 0.20,  # Production
    "53": 0.15,  # Transportation
}


# ============================================================================
# Track 4 — Offshoring Acceleration
# ============================================================================
# AI removes coordination friction (translation, time zone management,
# quality verification) that previously limited offshoring.
# Score = tradability × AI friction reduction potential.
#
# Source: BLS occupational tradability research + Blinder-Krueger (2013)
# "Alternative Measures of Offshorability"

OFFSHORING_SCORES = {
    # Highest offshoring acceleration (already partially tradable, AI removes barriers)
    "15-1251": 0.85,  # Computer Programmers — historically high offshoring + AI amplifies
    "15-1252": 0.70,  # Software Developers — significant but more complex than coding
    "15-1253": 0.75,  # QA Analysts — test execution highly offshorable
    "13-2011": 0.65,  # Accountants — routine accounting already offshored, AI expands scope
    "23-2011": 0.60,  # Paralegals — document review offshoring + AI translation
    "13-2051": 0.60,  # Financial Analysts — modeling + reporting
    "43-9021": 0.80,  # Data Entry — already heavily offshored, AI makes it cheaper
    "43-3031": 0.70,  # Bookkeeping — AI bridges language/standard barriers
    "15-1212": 0.55,  # Info Security — monitoring can be 24/7 global
    "27-3042": 0.65,  # Technical Writers — AI translation enables global writing teams
    "13-1071": 0.50,  # HR Specialists — screening/processing offshorable
    "27-3031": 0.55,  # PR Specialists — content creation offshorable

    # Medium (some tradability, AI moderately accelerates)
    "13-1161": 0.45,  # Market Research
    "41-3021": 0.40,  # Insurance Sales — processing backend
    "11-3031": 0.35,  # Financial Managers — some oversight remotable
    "25-1011": 0.30,  # Business Teachers — online education

    # Low (require physical presence or deep local context)
    "29-1141": 0.08,  # Nurses — physical patient care
    "53-3032": 0.02,  # Truck Drivers — physical presence required
    "47-2061": 0.01,  # Construction — physical
    "33-3051": 0.02,  # Police — local jurisdiction
    "39-9011": 0.01,  # Childcare — physical care
    "35-2014": 0.02,  # Cooks — physical
    "29-1215": 0.05,  # Surgeons — physical (telesurgery emerging but rare)
}

OFFSHORING_GROUP_DEFAULTS = {
    "11": 0.25,  # Management
    "13": 0.55,  # Business/Financial
    "15": 0.65,  # Computer/Math (highest)
    "17": 0.30,  # Architecture/Engineering
    "19": 0.25,  # Science
    "21": 0.10,  # Community/Social
    "23": 0.40,  # Legal
    "25": 0.20,  # Education
    "27": 0.40,  # Arts/Design
    "29": 0.08,  # Healthcare Practitioners
    "31": 0.05,  # Healthcare Support
    "33": 0.03,  # Protective Service
    "35": 0.03,  # Food Preparation
    "37": 0.02,  # Building Maintenance
    "39": 0.03,  # Personal Care
    "41": 0.20,  # Sales
    "43": 0.45,  # Office/Admin
    "45": 0.02,  # Farming
    "47": 0.02,  # Construction
    "49": 0.05,  # Installation/Maintenance
    "51": 0.15,  # Production
    "53": 0.05,  # Transportation
}


# ============================================================================
# Regulatory Friction (modifier, applied as dampener across all tracks)
# ============================================================================
REGULATORY_FRICTION_BY_SOC_GROUP = {
    "11": 0.15, "13": 0.20, "15": 0.10, "17": 0.25, "19": 0.15,
    "21": 0.30, "23": 0.70, "25": 0.55, "27": 0.10, "29": 0.75,
    "31": 0.35, "33": 0.65, "35": 0.15, "37": 0.20, "39": 0.20,
    "41": 0.10, "43": 0.15, "45": 0.10, "47": 0.30, "49": 0.25,
    "51": 0.30, "53": 0.35,
}

# Time-varying regulatory friction overrides for specific occupations.
# These are occupations where the regulatory landscape has a known trajectory
# (e.g., autonomous vehicle deregulation spreading from TX/AZ to national).
# Format: SOC → [(year, friction), ...] — interpolated between milestones.
FRICTION_TIME_OVERRIDES = {
    # Heavy truck drivers: Aurora commercially operating Dallas-Houston in 2025.
    # TX and AZ already permit driverless commercial operation.
    # Federal framework expected late 2020s.
    "53-3032": [(2025, 0.35), (2028, 0.25), (2032, 0.15), (2035, 0.10)],
    # Light truck drivers: same regulatory trajectory, slightly slower
    # (last-mile delivery in residential areas faces more local pushback)
    "53-3033": [(2025, 0.38), (2028, 0.28), (2032, 0.18), (2035, 0.12)],
    # Taxi/rideshare: Waymo already operating fully driverless in SF/Phoenix
    "53-3041": [(2025, 0.30), (2028, 0.20), (2032, 0.12), (2035, 0.08)],
}


def _get_friction(soc, year):
    """
    Get regulatory friction for a SOC code at a given year.
    Uses time-varying overrides if available, otherwise static group default.
    """
    if soc in FRICTION_TIME_OVERRIDES:
        milestones = FRICTION_TIME_OVERRIDES[soc]
        if year <= milestones[0][0]:
            return milestones[0][1]
        if year >= milestones[-1][0]:
            return milestones[-1][1]
        for i in range(len(milestones) - 1):
            y0, f0 = milestones[i]
            y1, f1 = milestones[i + 1]
            if y0 <= year <= y1:
                t = (year - y0) / (y1 - y0)
                return f0 + t * (f1 - f0)

    group = soc[:2]
    return REGULATORY_FRICTION_BY_SOC_GROUP.get(group, 0.20)


# ============================================================================
# Track weights
# ============================================================================
TRACK_WEIGHTS = {
    "cognitive": 0.35,      # Track 1
    "robotics": 0.20,       # Track 2
    "agentic": 0.20,        # Track 3 (0 before 2026, ramps to full by 2030)
    "offshoring": 0.15,     # Track 4
    # Remaining 0.10 is absorbed by regulatory friction modifier
}


def _get_score(soc, specific_dict, group_defaults, default=0.25):
    """Get score for a SOC code: specific match → group default → global default."""
    if soc in specific_dict:
        return specific_dict[soc]
    group = soc[:2]
    return group_defaults.get(group, default)


def agentic_time_weight(year):
    """Track 3 time scaling: 0 before 2026, linear ramp to 1.0 at 2030."""
    if year <= 2026:
        return 0.0
    elif year >= 2030:
        return 1.0
    else:
        return (year - 2026) / 4.0


def robotics_time_weight(year):
    """
    Track 2 time scaling: deployment curve for physical automation.

    Unlike agentic AI (zero-to-one software capability curve), robotics follows
    an S-curve driven by deployment infrastructure and regulation:
        2025: 0.40 — current deployment (Aurora highway pilots, Amazon warehouses,
              some ag automation). Real but limited to constrained environments.
        2027: 0.60 — regulatory frameworks clarifying, deployment accelerating
              across major logistics corridors and new warehouse facilities.
        2030: 0.85 — full commercial deployment on major corridors, warehouse
              automation near-complete, agricultural robotics mainstream.
        2035: 1.00 — near-complete for all robotics-amenable occupations.

    Interpolated linearly between milestones.
    """
    milestones = [(2025, 0.40), (2027, 0.60), (2030, 0.85), (2035, 1.00)]

    if year <= milestones[0][0]:
        return milestones[0][1]
    if year >= milestones[-1][0]:
        return milestones[-1][1]

    # Linear interpolation between milestones
    for i in range(len(milestones) - 1):
        y0, w0 = milestones[i]
        y1, w1 = milestones[i + 1]
        if y0 <= year <= y1:
            t = (year - y0) / (y1 - y0)
            return w0 + t * (w1 - w0)

    return 1.0


def compute_multi_track_scores(year=2025, trade_policy="current"):
    """
    Compute 4-track displacement scores for all occupations.

    Args:
        year: projection year (affects Track 3 agentic AI weight)
        trade_policy: 'current' | 'free_trade' | 'escalating_tariffs'

    Returns DataFrame with per-track scores and composite.
    """
    print(f"Computing multi-track displacement scores (year={year}, trade={trade_policy})...")

    conn = sqlite3.connect(DB_PATH)
    # Load Track 1 (cognitive) from existing composite_scores
    try:
        t1_df = pd.read_sql(
            "SELECT soc_code, occupation_title, composite_score_normalized FROM composite_scores",
            conn,
        )
    except Exception:
        # Fall back to occupation_exposure if composite not yet computed
        t1_df = pd.read_sql(
            "SELECT soc_code, occupation_title, ai_exposure as composite_score_normalized FROM occupation_exposure",
            conn,
        )
    conn.close()

    t1_scores = t1_df.set_index("soc_code")["composite_score_normalized"].to_dict()
    titles = t1_df.set_index("soc_code")["occupation_title"].to_dict()
    all_socs = set(t1_scores.keys())

    # Trade policy modifiers
    robotics_modifier = 1.0
    offshoring_modifier = 1.0
    if trade_policy == "escalating_tariffs":
        robotics_modifier = 1.50   # +50% robotics (reshoring paradox)
        offshoring_modifier = 0.70  # -30% offshoring
    elif trade_policy == "free_trade":
        robotics_modifier = 0.85   # -15% robotics
        offshoring_modifier = 1.30  # +30% offshoring

    # Time weights
    agentic_w = agentic_time_weight(year)
    robotics_w = robotics_time_weight(year)

    rows = []
    for soc in sorted(all_socs):
        t1 = t1_scores.get(soc, 0.5)
        t2_raw = _get_score(soc, ROBOTICS_SCORES, ROBOTICS_GROUP_DEFAULTS)
        t2 = min(1.0, t2_raw * robotics_w * robotics_modifier)  # Time-scaled + trade policy
        t3_raw = _get_score(soc, AGENTIC_AI_SCORES, AGENTIC_GROUP_DEFAULTS)
        t3 = t3_raw * agentic_w  # Time-scaled
        t4 = min(1.0, _get_score(soc, OFFSHORING_SCORES, OFFSHORING_GROUP_DEFAULTS) * offshoring_modifier)

        # Regulatory friction dampener (time-varying for specific occupations)
        friction = _get_friction(soc, year)
        friction_multiplier = 1.0 - (friction * 0.40)  # Max 40% reduction

        # Weighted composite
        # When agentic is zero (pre-2026), redistribute its weight to other tracks
        effective_weights = dict(TRACK_WEIGHTS)
        if agentic_w < 1.0:
            agentic_lost = effective_weights["agentic"] * (1.0 - agentic_w)
            effective_weights["agentic"] *= agentic_w
            # Redistribute lost agentic weight proportionally to cognitive and offshoring
            effective_weights["cognitive"] += agentic_lost * 0.6
            effective_weights["offshoring"] += agentic_lost * 0.4

        raw_composite = (
            t1 * effective_weights["cognitive"] +
            t2 * effective_weights["robotics"] +
            t3 * effective_weights["agentic"] +
            t4 * effective_weights["offshoring"]
        )

        # Apply friction dampener
        composite = raw_composite * friction_multiplier

        # Offshoring compounds with cognitive: high on both = extra risk
        cognitive_offshoring_compound = t1 * t4 * 0.10  # Up to 10% bonus
        composite += cognitive_offshoring_compound

        composite = min(1.0, max(0.0, composite))

        rows.append({
            "soc_code": soc,
            "occupation_title": titles.get(soc, "Unknown"),
            "composite_score": composite,
            "track1_cognitive": t1,
            "track2_robotics": t2,
            "track2_robotics_full": t2_raw,  # Full potential (ignoring time)
            "track3_agentic": t3,
            "track3_agentic_full": t3_raw,  # Full potential (ignoring time)
            "track4_offshoring": t4,
            "regulatory_friction": friction,
            "friction_multiplier": friction_multiplier,
            "year": year,
            "trade_policy": trade_policy,
        })

    df = pd.DataFrame(rows)

    # Normalize composite to [0, 1]
    min_s = df["composite_score"].min()
    max_s = df["composite_score"].max()
    if max_s > min_s:
        df["composite_normalized"] = (df["composite_score"] - min_s) / (max_s - min_s)
    else:
        df["composite_normalized"] = 0.5

    return df


def show_test_occupations(df, year):
    """Print test occupation breakdown."""
    test = [
        ("23-2011", "Paralegal"),
        ("13-2011", "Accountant"),
        ("53-3033", "Truck Driver"),
        ("15-1252", "Software Dev"),
        ("29-1141", "Nurse"),
    ]

    agentic_w = agentic_time_weight(year)
    robot_w = robotics_time_weight(year)
    print(f"\n  Year: {year} | Robotics: {robot_w:.0%} of full | Agentic: {agentic_w:.0%} of full")
    print(f"  {'Occupation':<16} {'Composite':>9} {'T1-Cog':>7} {'T2-Robot':>8} "
          f"{'T3-Agent':>8} {'T4-Offsh':>8} {'Friction':>8}")
    print(f"  {'-'*72}")
    for soc, name in test:
        r = df[df["soc_code"] == soc]
        if r.empty:
            print(f"  {name:<16} NOT FOUND")
            continue
        r = r.iloc[0]
        t2_label = f"{r['track2_robotics']:.2f}"
        t3_label = f"{r['track3_agentic']:.2f}" if agentic_w > 0 else f"({r['track3_agentic_full']:.2f})"
        print(f"  {name:<16} {r['composite_normalized']:>8.3f} {r['track1_cognitive']:>7.2f} "
              f"{t2_label:>8} {t3_label:>8} {r['track4_offshoring']:>8.2f} "
              f"{r['regulatory_friction']:>8.2f}")


def write_multi_track_to_sqlite(df):
    """Write multi-track scores to database."""
    conn = sqlite3.connect(DB_PATH)
    df.to_sql("multi_track_scores", conn, if_exists="replace", index=False)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_mt_soc ON multi_track_scores(soc_code)")

    # Also update occupation_exposure with new composite for map rendering
    for _, row in df.iterrows():
        conn.execute(
            "UPDATE occupation_exposure SET ai_exposure = ? WHERE soc_code = ?",
            (row["composite_normalized"], row["soc_code"]),
        )
    conn.commit()
    conn.close()
    print(f"  Written {len(df)} multi-track scores to database")


if __name__ == "__main__":
    # Show scores at three time horizons
    for year in [2025, 2028, 2035]:
        df = compute_multi_track_scores(year=year)
        show_test_occupations(df, year)

    # Write the 2025 baseline to database
    df_baseline = compute_multi_track_scores(year=2025)
    write_multi_track_to_sqlite(df_baseline)
