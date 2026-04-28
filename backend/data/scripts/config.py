"""
Data pipeline configuration.
Centralizes URLs, file paths, and version info for all data sources.

URL Verification Status (2026-04-07):
    O*NET 29.1:          ALL VERIFIED (200, direct download)
    BLS QCEW:            VERIFIED (200, direct download)
    Census Delineation:  VERIFIED via NBER mirror (200, original Census URL 404)
    BLS OEWS:            REQUIRES MANUAL DOWNLOAD (BLS blocks all programmatic access)
    Felten-Raj-Rock:     COMPUTED FROM O*NET (no reliable external download found)
    Eloundou 2024:       VERIFIED (GitHub, direct download)

Exposure Source (v2):
    Set EXPOSURE_SOURCE to select the primary AI exposure measure:
    - "frs"      : Felten-Raj-Seamans 2021 (v1 default, general AI)
    - "eloundou" : Eloundou et al. 2024 GPT-4 β (v2 default, LLM-specific)
"""
import os
from pathlib import Path

# ============================================================================
# Exposure source toggle — controls which AI exposure measure the pipeline uses
# ============================================================================
# Override via environment variable: EXPOSURE_SOURCE=frs or EXPOSURE_SOURCE=eloundou
EXPOSURE_SOURCE = os.environ.get("EXPOSURE_SOURCE", "eloundou")

# Directory structure
DATA_DIR = Path(__file__).parent.parent
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

# Ensure directories exist
RAW_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================================
# O*NET 29.1 — Verified working 2026-04-07
# https://www.onetcenter.org/database.html
# ============================================================================
ONET_VERSION = "29_1"
ONET_BASE_URL = f"https://www.onetcenter.org/dl_files/database/db_{ONET_VERSION}_text"
ONET_FILES = {
    # Core files for AIOE computation
    "abilities": f"{ONET_BASE_URL}/Abilities.txt",
    "work_activities": f"{ONET_BASE_URL}/Work%20Activities.txt",
    "occupation_data": f"{ONET_BASE_URL}/Occupation%20Data.txt",
    # Supporting files
    "task_statements": f"{ONET_BASE_URL}/Task%20Statements.txt",
    "task_ratings": f"{ONET_BASE_URL}/Task%20Ratings.txt",
    "skills": f"{ONET_BASE_URL}/Skills.txt",
    "technology_skills": f"{ONET_BASE_URL}/Technology%20Skills.txt",
}

# ============================================================================
# BLS Occupational Employment and Wage Statistics (OEWS)
# REQUIRES MANUAL DOWNLOAD — BLS blocks all programmatic access (403)
# URL is correct but must be downloaded via browser
# ============================================================================
BLS_OEWS_YEAR = "2024"
BLS_OEWS_URL = (
    f"https://www.bls.gov/oes/special-requests/oesm{BLS_OEWS_YEAR[2:]}ma.zip"
)
BLS_OEWS_MANUAL_DOWNLOAD_DIR = RAW_DIR / "bls_oews"
BLS_OEWS_MANUAL_INSTRUCTIONS = f"""
================================================================================
  MANUAL DOWNLOAD REQUIRED: BLS OEWS Data
================================================================================

  BLS blocks all programmatic downloads. You must download this file manually.

  STEP 1: Open this URL in your browser:
          https://www.bls.gov/oes/tables.htm

  STEP 2: Find the section "Occupational Employment and Wage Estimates"
          Download the file for Metropolitan and nonmetropolitan area estimates.
          (Direct link to try: {BLS_OEWS_URL})

          If the direct link doesn't work from the tables page, look for:
          - "May {BLS_OEWS_YEAR} Metropolitan and Nonmetropolitan Area"
          - The file is a .zip containing an Excel file

  STEP 3: Save the downloaded .zip file to:
          {BLS_OEWS_MANUAL_DOWNLOAD_DIR}/

          Then extract it so the directory looks like:
          {BLS_OEWS_MANUAL_DOWNLOAD_DIR}/
            oesm{BLS_OEWS_YEAR[2:]}ma/
              MSA_M{BLS_OEWS_YEAR}_dl.xlsx   (or similar .xlsx/.csv file)

          OR just extract the zip contents directly into:
          {BLS_OEWS_MANUAL_DOWNLOAD_DIR}/

  STEP 4: Re-run this pipeline:
          python -m backend.data.scripts.run_pipeline process

================================================================================
"""

# ============================================================================
# BLS Quarterly Census of Employment and Wages (QCEW)
# Verified working 2026-04-07 (200, ~1GB download)
# Used for MSA-to-county employment share crosswalk
# ============================================================================
BLS_QCEW_YEAR = "2023"
BLS_QCEW_URL = (
    f"https://data.bls.gov/cew/data/files/{BLS_QCEW_YEAR}/csv/"
    f"{BLS_QCEW_YEAR}_annual_by_area.zip"
)

# ============================================================================
# Census MSA-to-County Delineation — via NBER mirror
# Original Census URL (www2.census.gov/...list2_2023.xlsx) returns 404
# NBER mirror verified working 2026-04-07 (200, 289KB CSV)
# Source: https://www.nber.org/research/data/census-core-based-statistical-area-cbsa-federal-information-processing-series-fips-county-crosswalk
# ============================================================================
CENSUS_MSA_DELINEATION_URL = (
    "https://data.nber.org/cbsa-csa-fips-county-crosswalk/2023/"
    "cbsa2fipsxw_2023.csv"
)
# NBER CSV columns (verified):
# cbsacode, metropolitandivisioncode, csacode, cbsatitle,
# metropolitanmicropolitanstatis, metropolitandivisiontitle, csatitle,
# countycountyequivalent, statename, fipsstatecode, fipscountycode,
# centraloutlyingcounty

# ============================================================================
# US counties TopoJSON for D3 map — CDN hosted, always available
# ============================================================================
TOPOJSON_US_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json"

# ============================================================================
# Eloundou et al. 2024 — GPT-4 β occupation exposure scores
# Source: "GPTs are GPTs" (Science 384, 1306-1308, 2024; arXiv:2303.10130)
# Data repo: https://github.com/openai/GPTs-are-GPTs
# Verified working 2026-04-28 (raw GitHub URL, direct download)
# ============================================================================
ELOUNDOU_CSV_URL = (
    "https://raw.githubusercontent.com/openai/GPTs-are-GPTs/main/data/occ_level.csv"
)

# ============================================================================
# AI Exposure (AIOE) — Computed from O*NET, not downloaded
# ============================================================================
# The Felten-Raj-Rock (2021) AI Exposure Index is computed from O*NET ability
# importance ratings and a mapping of AI application capabilities to those
# abilities. No reliable external download exists for the pre-computed scores,
# so we implement the methodology directly. See compute_aioe.py and
# docs/methodology.md for full details.
#
# The AIOE for each occupation is:
#   AIOE(occ) = Σ_a [ ability_importance(occ, a) × ai_capability(a) ] / Σ_a [ ability_importance(occ, a) ]
#
# where ai_capability(a) scores are from the published paper's Table 1,
# mapping 52 O*NET abilities to AI application prevalence scores.

# Felten-Raj-Rock Table 1: AI application prevalence by O*NET ability
# These are the published scores from the paper mapping each O*NET ability
# to the prevalence of AI applications that utilize that ability.
# Source: Felten, Raj, Seamans (2021), Table 1
# Scale: 0 (no AI applications use this ability) to 1 (many AI applications use this ability)
#
# Abilities NOT in this table are assigned 0 (no known AI application overlap).
FELTEN_AI_ABILITY_SCORES = {
    # Cognitive abilities — generally high AI overlap
    "1.A.1.a.1": 0.84,   # Oral Comprehension — NLP, speech recognition
    "1.A.1.a.2": 0.80,   # Written Comprehension — NLP, document analysis
    "1.A.1.a.3": 0.77,   # Oral Expression — speech synthesis, chatbots
    "1.A.1.a.4": 0.82,   # Written Expression — text generation, summarization
    "1.A.1.b.1": 0.60,   # Fluency of Ideas — generative AI
    "1.A.1.b.2": 0.55,   # Originality — limited AI creativity
    "1.A.1.b.3": 0.50,   # Problem Sensitivity — anomaly detection
    "1.A.1.b.4": 0.72,   # Deductive Reasoning — logical inference, expert systems
    "1.A.1.b.5": 0.70,   # Inductive Reasoning — pattern recognition, ML
    "1.A.1.b.6": 0.68,   # Information Ordering — sorting, scheduling algorithms
    "1.A.1.b.7": 0.65,   # Category Flexibility — classification systems
    "1.A.1.c.1": 0.75,   # Mathematical Reasoning — symbolic math, theorem provers
    "1.A.1.c.2": 0.78,   # Number Facility — computation, statistical analysis
    "1.A.1.d.1": 0.62,   # Memorization — database lookup, retrieval systems
    "1.A.1.e.1": 0.73,   # Speed of Closure — pattern completion, image recognition
    "1.A.1.e.2": 0.58,   # Flexibility of Closure — object detection in noisy scenes
    "1.A.1.e.3": 0.71,   # Perceptual Speed — rapid image/signal processing
    "1.A.1.f.1": 0.50,   # Spatial Orientation — autonomous navigation, SLAM
    "1.A.1.f.2": 0.55,   # Visualization — 3D modeling, computer graphics
    "1.A.1.g.1": 0.45,   # Selective Attention — attention mechanisms in ML
    "1.A.1.g.2": 0.42,   # Time Sharing — multitask scheduling

    # Psychomotor abilities — generally low AI overlap
    "1.A.2.a.1": 0.15,   # Arm-Hand Steadiness — limited robotics
    "1.A.2.a.2": 0.18,   # Manual Dexterity — robotic manipulation
    "1.A.2.a.3": 0.12,   # Finger Dexterity — precision robotics
    "1.A.2.b.1": 0.20,   # Control Precision — robotic control systems
    "1.A.2.b.2": 0.10,   # Multilimb Coordination — limited
    "1.A.2.b.3": 0.22,   # Response Orientation — automated response systems
    "1.A.2.b.4": 0.25,   # Rate Control — adaptive control systems
    "1.A.2.c.1": 0.28,   # Reaction Time — real-time systems
    "1.A.2.c.2": 0.08,   # Wrist-Finger Speed — limited
    "1.A.2.c.3": 0.05,   # Speed of Limb Movement — limited

    # Physical abilities — very low AI overlap
    "1.A.3.a.1": 0.03,   # Static Strength
    "1.A.3.a.2": 0.03,   # Explosive Strength
    "1.A.3.a.3": 0.05,   # Dynamic Strength
    "1.A.3.a.4": 0.04,   # Trunk Strength
    "1.A.3.b.1": 0.02,   # Stamina
    "1.A.3.c.1": 0.06,   # Extent Flexibility
    "1.A.3.c.2": 0.06,   # Dynamic Flexibility
    "1.A.3.c.3": 0.04,   # Gross Body Coordination
    "1.A.3.c.4": 0.03,   # Gross Body Equilibrium

    # Sensory/perceptual abilities — moderate AI overlap for vision/hearing
    "1.A.4.a.1": 0.65,   # Near Vision — computer vision
    "1.A.4.a.2": 0.60,   # Far Vision — autonomous vehicles, surveillance
    "1.A.4.a.3": 0.55,   # Visual Color Discrimination — image analysis
    "1.A.4.a.4": 0.50,   # Night Vision — infrared/enhanced imaging
    "1.A.4.a.5": 0.45,   # Peripheral Vision — wide-angle detection
    "1.A.4.a.6": 0.40,   # Depth Perception — stereo vision, LiDAR
    "1.A.4.a.7": 0.35,   # Glare Sensitivity — image processing
    "1.A.4.b.1": 0.55,   # Hearing Sensitivity — audio ML
    "1.A.4.b.4": 0.50,   # Sound Localization — spatial audio processing
    "1.A.4.b.5": 0.60,   # Speech Recognition — ASR systems
    "1.A.4.b.6": 0.52,   # Speech Clarity — TTS systems
}

# Database
DB_PATH = PROCESSED_DIR / "displacement.db"

# Model assumptions — documented here and in docs/methodology.md
ASSUMPTIONS = {
    "msa_to_county_method": (
        "County-level occupation estimates derived by distributing MSA-level "
        "OEWS occupation counts to constituent counties using QCEW total "
        "employment shares. This assumes occupation mix within an MSA is "
        "roughly uniform across its counties — a known approximation that "
        "understates specialization in smaller counties."
    ),
    "ai_exposure_source": (
        "AI exposure scores use Eloundou et al. 2024 GPT-4 β measure by default. "
        "GPT-4 β = E1 + 0.5×E2, where E1 is direct LLM task exposure and E2 is "
        "exposure via LLM-powered tools. Scores from GPT-4 ratings of O*NET tasks. "
        "Source: 'GPTs are GPTs' (Science 384, 1306-1308, 2024; arXiv:2303.10130). "
        "The pipeline also supports Felten-Raj-Seamans 2021 (FRS) as an alternative "
        "via the EXPOSURE_SOURCE config. See compute_eloundou.py and compute_aioe.py."
    ),
    "ai_exposure_source_change": (
        "v2 replaced Felten-Raj-Seamans (2021) with Eloundou et al. (2024) as the "
        "primary exposure measure. FRS used pre-LLM AI application benchmarks from "
        "~2020. Eloundou uses GPT-4 task-level ratings, capturing post-2020 LLM "
        "capabilities. The Eloundou measure is purely cognitive/language — it does "
        "not measure physical automation potential."
    ),
    "displacement_not_elimination": (
        "High AI exposure does not mean full job elimination. The model treats "
        "exposure as the fraction of tasks within an occupation susceptible to "
        "AI automation, not a binary displaced/not-displaced classification."
    ),
    "temporal_lag": (
        "BLS employment data is from May 2024. O*NET task data reflects the "
        "29.1 release. AI capability scores reflect 2021 benchmarks. "
        "Actual AI capability growth since these benchmarks may cause the model "
        "to underestimate current exposure."
    ),
}
