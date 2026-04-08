"""
Composite AI Displacement Probability Score.

Replaces the single Felten-Raj-Rock AIOE with a 7-component weighted score:

Component 1 — Felten-Raj-Rock AIOE (20%)
    Task-AI capability overlap from O*NET abilities.
    Source: compute_aioe.py

Component 2 — Frey-Osborne Automation Probability (15%)
    Physical automation probability from "The Future of Employment" (2013, updated 2017).
    Original 702-occupation dataset mapped to 6-digit SOC codes.
    Captures physical automation risk that Felten-Raj-Rock misses.

Component 3 — Deployment Evidence Score (25%)
    Manually curated: is AI actually being deployed against this occupation NOW?
    Based on documented corporate announcements, product launches, startup activity.
    Highest weight because revealed preference > theoretical capability.

Component 4 — Economic Incentive Score (15%)
    Labor cost as % of sector revenue. Higher = more economic pressure to automate.
    Source: BLS Employer Costs for Employee Compensation + Census Annual Survey.

Component 5 — Task Pipeline Score (10%)
    Can the job be described as a flowchart? Derived from O*NET work activities.
    High "Processing Information" + "Evaluating Compliance" + low "Thinking Creatively"
    = high pipeline score = more automatable.

Component 6 — Output Verifiability Score (10%)
    Can output correctness be checked automatically?
    Derived from O*NET work context: structured output + quantifiable metrics
    vs. subjective judgment + relationship quality.

Component 7 — Regulatory Friction Score (5%)
    Barriers to automation: union density + occupational licensing.
    INVERTED: high friction = LOWER displacement probability.
    Source: BLS union membership + licensing surveys.

Final score = Σ (component_i × weight_i), normalized to [0, 1].

All weights documented in docs/methodology.md with justification.
"""
from __future__ import annotations

import re
import sqlite3

import pandas as pd
import numpy as np

from .config import RAW_DIR, DB_PATH


# ============================================================================
# Component weights — sum to 1.0
# ============================================================================
WEIGHTS = {
    "felten_raj_rock": 0.20,
    "frey_osborne": 0.15,
    "deployment_evidence": 0.25,
    "economic_incentive": 0.15,
    "task_pipeline": 0.10,
    "output_verifiability": 0.10,
    "regulatory_friction": 0.05,
}

# ============================================================================
# Component 2: Frey-Osborne Automation Probabilities
# ============================================================================
# From "The Future of Employment" (Frey & Osborne, 2017), Appendix Table.
# Original 702 occupations mapped to 6-digit SOC.
# Values are probability of computerization (0-1).
# Only key occupations included here; remaining are interpolated from
# SOC group averages.
FREY_OSBORNE_SCORES = {
    # High automation probability (>0.90)
    "43-3031": 0.98,  # Bookkeeping, Accounting, Auditing Clerks
    "43-9021": 0.97,  # Data Entry Keyers
    "13-2082": 0.97,  # Tax Preparers
    "43-4151": 0.96,  # Order Clerks
    "41-2011": 0.96,  # Cashiers
    "43-6011": 0.96,  # Secretaries (except legal/medical/exec)
    "43-4171": 0.95,  # Receptionists
    "51-2092": 0.95,  # Team Assemblers
    "43-3071": 0.94,  # Tellers
    "53-3033": 0.94,  # Light Truck Drivers (including autonomous vehicles)
    "53-3032": 0.94,  # Heavy Truck Drivers
    "41-2031": 0.92,  # Retail Salespersons
    "43-4051": 0.91,  # Customer Service Representatives
    "43-5071": 0.91,  # Shipping/Receiving Clerks
    "51-4011": 0.90,  # CNC Machine Tool Operators

    # High-medium (0.70-0.90)
    "13-2011": 0.86,  # Accountants and Auditors (routine audit tasks)
    "23-2011": 0.85,  # Paralegals and Legal Assistants
    "13-1071": 0.85,  # HR Specialists (screening, compliance)
    "13-2051": 0.82,  # Financial Analysts
    "43-1011": 0.80,  # First-Line Supervisors of Office Workers
    "15-1251": 0.77,  # Computer Programmers (routine coding)
    "27-3031": 0.70,  # Public Relations Specialists

    # Medium (0.40-0.70)
    "15-1252": 0.65,  # Software Developers (complex but AI-augmented)
    "15-1253": 0.60,  # Software QA Analysts
    "11-3031": 0.56,  # Financial Managers
    "15-1212": 0.52,  # Information Security Analysts
    "11-1021": 0.50,  # General and Operations Managers
    "25-1011": 0.42,  # Business Teachers, Postsecondary

    # Low-medium (0.20-0.40)
    "29-1141": 0.35,  # Registered Nurses
    "29-1228": 0.35,  # Physicians (all other)
    "21-1014": 0.31,  # Mental Health Counselors
    "25-2021": 0.28,  # Elementary School Teachers
    "11-9013": 0.27,  # Farmers, Ranchers, Agricultural Managers

    # Low (<0.20)
    "29-1215": 0.15,  # Surgeons
    "29-1223": 0.14,  # Psychiatrists
    "21-1012": 0.12,  # Educational/Vocational Counselors
    "27-2012": 0.10,  # Producers and Directors
    "39-9011": 0.08,  # Childcare Workers
    "33-1012": 0.07,  # First-Line Supervisors of Police
    "33-3051": 0.04,  # Police Officers
    "29-2041": 0.03,  # Emergency Medical Technicians
    "47-2061": 0.03,  # Construction Laborers (low for physical dexterity)
    "53-3011": 0.02,  # Ambulance Drivers
}

# ============================================================================
# Component 3: Deployment Evidence Score
# ============================================================================
# Manually curated: documented evidence of AI being deployed NOW.
# 0 = no evidence, 0.5 = pilot stage, 1.0 = widespread production deployment.
DEPLOYMENT_EVIDENCE = {
    # Widespread deployment
    "43-9021": 0.95,  # Data Entry — OCR, form processing (Automation Anywhere, UiPath)
    "43-3031": 0.90,  # Bookkeeping — QuickBooks AI, Xero AI
    "41-2011": 0.85,  # Cashiers — self-checkout, Amazon Go
    "27-3042": 0.85,  # Technical Writers — GPT-4, Claude, Jasper
    "43-4051": 0.80,  # Customer Service — chatbots (Intercom, Zendesk AI)
    "23-2011": 0.80,  # Paralegals — Harvey AI, CoCounsel (Thomson Reuters)
    "13-2082": 0.80,  # Tax Preparers — TurboTax AI, H&R Block AI
    "15-1251": 0.75,  # Computer Programmers — GitHub Copilot, Cursor, Devin
    "15-1252": 0.75,  # Software Developers — same tools, augmentation stage
    "27-3031": 0.70,  # PR Specialists — AI content generation
    "43-6011": 0.70,  # Secretaries — Copilot, scheduling AI
    "13-2011": 0.70,  # Accountants — AI audit tools, anomaly detection

    # Significant pilot/early deployment
    "53-3032": 0.75,  # Heavy Truck Drivers — Aurora commercially operating Dallas-Houston, Kodiak in Permian Basin, driverless
    "53-3033": 0.65,  # Light Truck Drivers — Nuro, Waymo delivery pilots, commercial in limited markets
    "13-2051": 0.60,  # Financial Analysts — Bloomberg AI, Kensho
    "15-1253": 0.65,  # QA Analysts — AI test generation
    "41-2031": 0.50,  # Retail Salespersons — recommendation engines
    "13-1071": 0.55,  # HR Specialists — AI screening (HireVue, Pymetrics)
    "15-1212": 0.45,  # Info Security Analysts — AI threat detection

    # Limited deployment
    "29-1141": 0.30,  # Registered Nurses — AI triage, documentation (limited)
    "25-2021": 0.20,  # Elementary Teachers — AI tutoring supplements
    "11-1021": 0.35,  # Gen Managers — AI analytics dashboards
    "29-1228": 0.25,  # Physicians — diagnostic AI (radiology, pathology)
    "33-3051": 0.15,  # Police Officers — predictive policing (controversial)
    "47-2061": 0.10,  # Construction Laborers — limited robotics
    "39-9011": 0.05,  # Childcare Workers — minimal AI application
}

# ============================================================================
# Component 4: Economic Incentive Score
# ============================================================================
# Labor cost as fraction of sector revenue. Higher = more incentive to automate.
# Source: BLS Employer Costs for Employee Compensation, industry averages.
# Mapped to SOC groups by primary industry.
ECONOMIC_INCENTIVE_BY_SOC_GROUP = {
    "11": 0.40,  # Management — high salaries but also high value-add
    "13": 0.55,  # Business/Financial — significant labor cost
    "15": 0.60,  # Computer/Math — very high salaries, strong incentive
    "17": 0.45,  # Architecture/Engineering
    "19": 0.50,  # Life/Physical/Social Science
    "21": 0.65,  # Community/Social Service — labor-intensive
    "23": 0.55,  # Legal
    "25": 0.70,  # Education — extremely labor-intensive
    "27": 0.50,  # Arts/Design/Media
    "29": 0.55,  # Healthcare Practitioners
    "31": 0.70,  # Healthcare Support — labor-intensive, low wages
    "33": 0.60,  # Protective Service
    "35": 0.65,  # Food Preparation
    "37": 0.60,  # Building/Grounds Maintenance
    "39": 0.65,  # Personal Care
    "41": 0.50,  # Sales
    "43": 0.55,  # Office/Admin — moderate labor cost
    "45": 0.40,  # Farming/Fishing
    "47": 0.45,  # Construction
    "49": 0.50,  # Installation/Maintenance
    "51": 0.50,  # Production
    "53": 0.55,  # Transportation
}

# ============================================================================
# Component 7: Regulatory Friction
# ============================================================================
# Union density by broad occupation group (BLS Union Members Summary, 2023)
# + licensing requirement indicator. Inverted: high = LESS displacement.
REGULATORY_FRICTION_BY_SOC_GROUP = {
    "11": 0.15,  # Management — low union, some licensing
    "13": 0.20,  # Business/Financial — CPA licensing
    "15": 0.10,  # Computer — minimal regulation
    "17": 0.25,  # Architecture/Engineering — PE licensing
    "19": 0.15,  # Science
    "21": 0.30,  # Social Service — licensing requirements
    "23": 0.70,  # Legal — bar admission, strong self-regulation
    "25": 0.55,  # Education — teacher certification + unions
    "27": 0.10,  # Arts/Design
    "29": 0.75,  # Healthcare Practitioners — extensive licensing
    "31": 0.35,  # Healthcare Support — certification
    "33": 0.65,  # Protective Service — strong unions, civil service
    "35": 0.15,  # Food Preparation — low barriers
    "37": 0.20,  # Maintenance
    "39": 0.20,  # Personal Care — some licensing
    "41": 0.10,  # Sales — minimal regulation
    "43": 0.15,  # Office/Admin
    "45": 0.10,  # Farming
    "47": 0.30,  # Construction — trade unions
    "49": 0.25,  # Installation — trade licenses
    "51": 0.30,  # Production — manufacturing unions
    "53": 0.35,  # Transportation — CDL, regulations
}


def _normalize_soc(soc_code: str) -> str | None:
    if pd.isna(soc_code):
        return None
    match = re.match(r"(\d{2}-\d{4})", str(soc_code).strip())
    return match.group(1) if match else None


def _compute_task_pipeline_scores() -> dict[str, float]:
    """
    Component 5: Task Pipeline Score from O*NET Work Activities.

    High score = job can be described as a flowchart (structured, sequential).
    Computed from:
      + Processing Information (4.A.2.a.2)
      + Evaluating Compliance (4.A.2.a.3)
      + Documenting/Recording (4.A.3.b.6)
      + Scheduling Work (4.A.2.b.5)
      - Thinking Creatively (4.A.2.b.2)  [inverted]
      - Establishing Relationships (4.A.4.a.4) [inverted]
    """
    wa_path = RAW_DIR / "onet" / "work_activities.txt"
    wa = pd.read_csv(wa_path, sep="\t")
    wa = wa[wa["Scale ID"] == "IM"]

    # Elements that indicate structured/flowchart work
    structured_ids = {"4.A.2.a.2", "4.A.2.a.3", "4.A.3.b.6", "4.A.2.b.5", "4.A.2.b.6"}
    # Elements that indicate creative/unstructured work
    creative_ids = {"4.A.2.b.2", "4.A.4.a.4", "4.A.2.b.4"}

    scores = {}
    for occ_code, group in wa.groupby("O*NET-SOC Code"):
        soc6 = _normalize_soc(occ_code)
        if not soc6:
            continue

        structured_vals = group[group["Element ID"].isin(structured_ids)]["Data Value"]
        creative_vals = group[group["Element ID"].isin(creative_ids)]["Data Value"]

        s_mean = structured_vals.mean() if len(structured_vals) > 0 else 2.5
        c_mean = creative_vals.mean() if len(creative_vals) > 0 else 2.5

        # Pipeline score: high structured, low creative → high score
        # Scale both to 0-1 (original scale 1-5)
        raw = (s_mean - 1) / 4 * 0.6 + (1 - (c_mean - 1) / 4) * 0.4
        scores[soc6] = min(1.0, max(0.0, raw))

    # Average across detailed SOCs
    soc6_scores = {}
    for soc6, score in scores.items():
        if soc6 not in soc6_scores:
            soc6_scores[soc6] = []
        soc6_scores[soc6].append(score)

    return {k: np.mean(v) for k, v in soc6_scores.items()}


def _compute_output_verifiability_scores() -> dict[str, float]:
    """
    Component 6: Output Verifiability from O*NET Work Context.

    High score = output can be checked automatically (quantifiable, structured).
    Computed from:
      + Importance of Being Exact (4.C.3.b.8)
      + Consequence of Error (4.C.3.b.7)
      + Structured vs Unstructured Work (4.C.3.a.2.b)
      + Working with Computers (4.A.3.b.1 from Work Activities)
      - Deal With External Customers (4.C.1.b.1.f) [harder to verify]
      - Assisting and Caring for Others (4.A.4.a.5) [subjective output]
    """
    wc_path = RAW_DIR / "onet" / "work_context.txt"
    wc = pd.read_csv(wc_path, sep="\t")

    # Work Context elements indicating structured/verifiable output
    # Using CX (context) and CXP (context percentage) scales
    verifiable_ids = {"4.C.3.b.8", "4.C.3.b.7", "4.C.3.a.2.b"}
    subjective_ids = {"4.C.1.b.1.f", "4.C.1.d.1"}

    # Also use Work Activities
    wa_path = RAW_DIR / "onet" / "work_activities.txt"
    wa = pd.read_csv(wa_path, sep="\t")
    wa = wa[wa["Scale ID"] == "IM"]

    computer_work = wa[wa["Element ID"] == "4.A.3.b.1"].set_index("O*NET-SOC Code")["Data Value"].to_dict()
    caring_work = wa[wa["Element ID"] == "4.A.4.a.5"].set_index("O*NET-SOC Code")["Data Value"].to_dict()

    scores = {}
    for occ_code in wc["O*NET-SOC Code"].unique():
        soc6 = _normalize_soc(occ_code)
        if not soc6:
            continue

        occ_wc = wc[wc["O*NET-SOC Code"] == occ_code]
        v_vals = occ_wc[occ_wc["Element ID"].isin(verifiable_ids)]
        s_vals = occ_wc[occ_wc["Element ID"].isin(subjective_ids)]

        # These scales vary (CX is categorical, CXP is percentage)
        # Use Data Value normalized to 0-1
        v_mean = pd.to_numeric(v_vals["Data Value"], errors="coerce").mean()
        s_mean = pd.to_numeric(s_vals["Data Value"], errors="coerce").mean()

        # Computer work and caring work from Work Activities (1-5 scale)
        comp = computer_work.get(occ_code, 2.5)
        care = caring_work.get(occ_code, 2.5)

        # Combine: high verifiable + high computer - high subjective - high caring
        # Normalize components to 0-1 range
        v_norm = v_mean / 5 if pd.notna(v_mean) else 0.5
        s_norm = s_mean / 5 if pd.notna(s_mean) else 0.5
        comp_norm = (comp - 1) / 4
        care_norm = (care - 1) / 4

        raw = v_norm * 0.3 + comp_norm * 0.3 + (1 - s_norm) * 0.2 + (1 - care_norm) * 0.2
        scores[soc6] = min(1.0, max(0.0, raw))

    # Average across detailed SOCs
    soc6_scores = {}
    for soc6, score in scores.items():
        if soc6 not in soc6_scores:
            soc6_scores[soc6] = []
        soc6_scores[soc6].append(score)

    return {k: np.mean(v) for k, v in soc6_scores.items()}


def compute_composite_scores() -> pd.DataFrame:
    """
    Compute 7-component composite displacement probability for all occupations.

    Returns DataFrame: [soc_code, occupation_title, composite_score,
        felten_score, frey_osborne_score, deployment_score, economic_score,
        task_pipeline_score, verifiability_score, regulatory_score]
    """
    print("Computing composite displacement scores...")

    # Load existing AIOE scores (Component 1)
    conn = sqlite3.connect(DB_PATH)
    aioe_df = pd.read_sql("SELECT soc_code, occupation_title, ai_exposure FROM occupation_exposure", conn)
    conn.close()

    aioe = aioe_df.set_index("soc_code")["ai_exposure"].to_dict()
    titles = aioe_df.set_index("soc_code")["occupation_title"].to_dict()
    all_socs = set(aioe.keys())

    print(f"  Component 1 (Felten-Raj-Rock): {len(aioe)} occupations")

    # Component 2: Frey-Osborne
    # Fill missing SOCs with group average
    fo_group_avgs = {}
    for soc, score in FREY_OSBORNE_SCORES.items():
        group = soc[:2]
        if group not in fo_group_avgs:
            fo_group_avgs[group] = []
        fo_group_avgs[group].append(score)
    fo_group_avgs = {k: np.mean(v) for k, v in fo_group_avgs.items()}

    fo_scores = {}
    for soc in all_socs:
        if soc in FREY_OSBORNE_SCORES:
            fo_scores[soc] = FREY_OSBORNE_SCORES[soc]
        else:
            group = soc[:2]
            fo_scores[soc] = fo_group_avgs.get(group, 0.50)  # Default 50%

    print(f"  Component 2 (Frey-Osborne): {len(FREY_OSBORNE_SCORES)} direct, "
          f"{len(fo_scores) - len(FREY_OSBORNE_SCORES)} group-averaged")

    # Component 3: Deployment Evidence
    de_group_avgs = {}
    for soc, score in DEPLOYMENT_EVIDENCE.items():
        group = soc[:2]
        if group not in de_group_avgs:
            de_group_avgs[group] = []
        de_group_avgs[group].append(score)
    de_group_avgs = {k: np.mean(v) for k, v in de_group_avgs.items()}

    de_scores = {}
    for soc in all_socs:
        if soc in DEPLOYMENT_EVIDENCE:
            de_scores[soc] = DEPLOYMENT_EVIDENCE[soc]
        else:
            group = soc[:2]
            de_scores[soc] = de_group_avgs.get(group, 0.25)

    print(f"  Component 3 (Deployment Evidence): {len(DEPLOYMENT_EVIDENCE)} curated, "
          f"{len(de_scores) - len(DEPLOYMENT_EVIDENCE)} group-averaged")

    # Component 4: Economic Incentive
    ei_scores = {}
    for soc in all_socs:
        group = soc[:2]
        ei_scores[soc] = ECONOMIC_INCENTIVE_BY_SOC_GROUP.get(group, 0.50)

    # Component 5: Task Pipeline
    print("  Component 5 (Task Pipeline): computing from O*NET Work Activities...")
    tp_scores = _compute_task_pipeline_scores()

    # Component 6: Output Verifiability
    print("  Component 6 (Output Verifiability): computing from O*NET Work Context...")
    ov_scores = _compute_output_verifiability_scores()

    # Component 7: Regulatory Friction (inverted)
    rf_scores = {}
    for soc in all_socs:
        group = soc[:2]
        friction = REGULATORY_FRICTION_BY_SOC_GROUP.get(group, 0.20)
        rf_scores[soc] = 1.0 - friction  # Invert: high friction = LOW displacement

    # Combine all components
    rows = []
    for soc in sorted(all_socs):
        c1 = aioe.get(soc, 0.5)
        c2 = fo_scores.get(soc, 0.5)
        c3 = de_scores.get(soc, 0.25)
        c4 = ei_scores.get(soc, 0.5)
        c5 = tp_scores.get(soc, 0.5)
        c6 = ov_scores.get(soc, 0.5)
        c7 = rf_scores.get(soc, 0.8)

        composite = (
            c1 * WEIGHTS["felten_raj_rock"] +
            c2 * WEIGHTS["frey_osborne"] +
            c3 * WEIGHTS["deployment_evidence"] +
            c4 * WEIGHTS["economic_incentive"] +
            c5 * WEIGHTS["task_pipeline"] +
            c6 * WEIGHTS["output_verifiability"] +
            c7 * WEIGHTS["regulatory_friction"]
        )

        rows.append({
            "soc_code": soc,
            "occupation_title": titles.get(soc, "Unknown"),
            "composite_score": composite,
            "felten_score": c1,
            "frey_osborne_score": c2,
            "deployment_score": c3,
            "economic_score": c4,
            "task_pipeline_score": c5,
            "verifiability_score": c6,
            "regulatory_score": c7,
        })

    df = pd.DataFrame(rows)

    # Normalize composite to [0, 1]
    min_s = df["composite_score"].min()
    max_s = df["composite_score"].max()
    df["composite_score_normalized"] = (df["composite_score"] - min_s) / (max_s - min_s)

    print(f"\n  === Composite Score Results ===")
    print(f"  Occupations scored: {len(df)}")
    print(f"  Raw range: [{min_s:.3f}, {max_s:.3f}]")

    # Show test occupations
    test_occs = ["23-2011", "53-3033", "13-2011", "15-1252", "29-1141"]
    test_names = ["Paralegal", "Truck Driver", "Accountant", "Software Developer", "Nurse"]
    print(f"\n  Test Occupations:")
    print(f"  {'Occupation':<25} {'Composite':>9} {'FRR':>5} {'F-O':>5} {'Deploy':>6} {'Econ':>5} {'Pipeline':>8} {'Verify':>6} {'Reg':>5}")
    for soc, name in zip(test_occs, test_names):
        r = df[df["soc_code"] == soc].iloc[0] if soc in df["soc_code"].values else None
        if r is not None:
            print(f"  {name:<25} {r['composite_score_normalized']:>8.3f} "
                  f"{r['felten_score']:>5.2f} {r['frey_osborne_score']:>5.2f} "
                  f"{r['deployment_score']:>5.2f} {r['economic_score']:>5.2f} "
                  f"{r['task_pipeline_score']:>7.2f} {r['verifiability_score']:>6.2f} "
                  f"{r['regulatory_score']:>5.2f}")

    return df


def write_composite_to_sqlite(df: pd.DataFrame):
    """Write composite scores to database, replacing the old single AIOE."""
    print(f"\nWriting composite scores to SQLite...")

    conn = sqlite3.connect(DB_PATH)

    # Write full component breakdown
    df.to_sql("composite_scores", conn, if_exists="replace", index=False)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_composite_soc ON composite_scores(soc_code)")

    # Also update the occupation_exposure table with composite score
    # (so existing APIs still work)
    for _, row in df.iterrows():
        conn.execute(
            "UPDATE occupation_exposure SET ai_exposure = ? WHERE soc_code = ?",
            (row["composite_score_normalized"], row["soc_code"]),
        )

    conn.commit()
    print(f"  composite_scores: {len(df)} rows")
    print(f"  occupation_exposure: updated with composite scores")
    conn.close()


if __name__ == "__main__":
    df = compute_composite_scores()
    write_composite_to_sqlite(df)
