"""
International AI exposure scores for all countries.

Three tiers of data quality:

Tier 1 — OECD countries (7): Full ISCO-08 occupation breakdowns from national
    labor force surveys. Scores computed from 9 ISCO major groups × AI exposure.

Tier 2 — World Bank countries (~190): Employment by sector (agriculture, industry,
    services) from World Bank Development Indicators. Scores estimated by mapping
    sector shares to weighted AI exposure. Clearly labeled as "Estimated."

Tier 3 — No data: Countries with no World Bank employment data. Shown as
    gray on the map with "Insufficient data" tooltip.

Data sources:
    - OECD Employment Outlook 2023 / national labor force surveys (Tier 1)
    - World Bank SL.AGR.EMPL.ZS, SL.IND.EMPL.ZS, SL.SRV.EMPL.ZS (Tier 2)
    - World Bank SP.POP.TOTL, SL.TLF.TOTL.IN for employment counts
"""
from __future__ import annotations

import json
import sqlite3

import pandas as pd

from .config import RAW_DIR, DB_PATH


# ============================================================================
# ISCO-08 → AI Exposure (Tier 1: OECD countries)
# ============================================================================
ISCO_EXPOSURE = {
    1: {"name": "Managers", "ai_exposure": 0.62},
    2: {"name": "Professionals", "ai_exposure": 0.75},
    3: {"name": "Technicians and Associate Professionals", "ai_exposure": 0.58},
    4: {"name": "Clerical Support Workers", "ai_exposure": 0.72},
    5: {"name": "Service and Sales Workers", "ai_exposure": 0.35},
    6: {"name": "Skilled Agricultural Workers", "ai_exposure": 0.18},
    7: {"name": "Craft and Related Trades Workers", "ai_exposure": 0.22},
    8: {"name": "Plant and Machine Operators", "ai_exposure": 0.25},
    9: {"name": "Elementary Occupations", "ai_exposure": 0.15},
}

# Sector-level AI exposure for Tier 2 estimation
# Agriculture maps to ISCO 6,9 (low exposure)
# Industry maps to ISCO 7,8,3 mix (low-medium)
# Services maps to ISCO 1,2,3,4,5 mix (medium-high)
SECTOR_EXPOSURE = {
    "agriculture": 0.17,   # Weighted avg of ISCO 6 (0.18) and ISCO 9 (0.15)
    "industry": 0.30,      # Weighted avg of ISCO 7 (0.22), 8 (0.25), 3 (0.58)
    "services": 0.55,      # Weighted avg of ISCO 1-5 (0.62,0.75,0.58,0.72,0.35)
}

# ============================================================================
# Tier 1: OECD countries with full ISCO breakdowns
# ============================================================================
OECD_COUNTRY_DATA = {
    "USA": {
        "name": "United States", "year": 2023,
        "source": "BLS Current Population Survey",
        "total_employment": 161_000_000,
        "isco_shares": {1:0.107, 2:0.244, 3:0.171, 4:0.117, 5:0.164, 6:0.007, 7:0.064, 8:0.056, 9:0.070},
    },
    "GBR": {
        "name": "United Kingdom", "year": 2023,
        "source": "ONS Labour Force Survey",
        "total_employment": 33_000_000,
        "isco_shares": {1:0.112, 2:0.260, 3:0.151, 4:0.097, 5:0.168, 6:0.009, 7:0.073, 8:0.047, 9:0.083},
    },
    "CAN": {
        "name": "Canada", "year": 2023,
        "source": "Statistics Canada Labour Force Survey",
        "total_employment": 20_400_000,
        "isco_shares": {1:0.098, 2:0.228, 3:0.167, 4:0.120, 5:0.177, 6:0.016, 7:0.072, 8:0.051, 9:0.071},
    },
    "AUS": {
        "name": "Australia", "year": 2023,
        "source": "ABS Labour Force Survey",
        "total_employment": 14_000_000,
        "isco_shares": {1:0.133, 2:0.262, 3:0.148, 4:0.119, 5:0.151, 6:0.020, 7:0.076, 8:0.043, 9:0.048},
    },
    "DEU": {
        "name": "Germany", "year": 2022,
        "source": "Destatis Mikrozensus",
        "total_employment": 45_600_000,
        "isco_shares": {1:0.048, 2:0.213, 3:0.219, 4:0.109, 5:0.147, 6:0.011, 7:0.110, 8:0.070, 9:0.073},
    },
    "FRA": {
        "name": "France", "year": 2022,
        "source": "INSEE Enquête Emploi",
        "total_employment": 30_600_000,
        "isco_shares": {1:0.058, 2:0.215, 3:0.177, 4:0.111, 5:0.164, 6:0.021, 7:0.092, 8:0.072, 9:0.090},
    },
    "JPN": {
        "name": "Japan", "year": 2022,
        "source": "Statistics Bureau Labour Force Survey",
        "total_employment": 67_200_000,
        "isco_shares": {1:0.025, 2:0.185, 3:0.165, 4:0.155, 5:0.174, 6:0.028, 7:0.090, 8:0.088, 9:0.090},
    },
}

# ISO-3166 numeric → ISO3 alpha (for TopoJSON matching)
# World atlas TopoJSON uses numeric IDs
# We need a comprehensive mapping. This covers the ~195 UN member states.
def _load_numeric_to_iso3():
    """Build numeric→ISO3 mapping from the world TopoJSON properties."""
    # Standard ISO 3166-1 numeric codes for major countries
    # Full list: https://en.wikipedia.org/wiki/ISO_3166-1_numeric
    return {
        "004":"AFG","008":"ALB","012":"DZA","020":"AND","024":"AGO","028":"ATG",
        "031":"AZE","032":"ARG","036":"AUS","040":"AUT","044":"BHS","048":"BHR",
        "050":"BGD","051":"ARM","052":"BRB","056":"BEL","060":"BMU","064":"BTN",
        "068":"BOL","070":"BIH","072":"BWA","076":"BRA","084":"BLZ","090":"SLB",
        "092":"VGB","096":"BRN","100":"BGR","104":"MMR","108":"BDI","112":"BLR",
        "116":"KHM","120":"CMR","124":"CAN","132":"CPV","140":"CAF","144":"LKA",
        "148":"TCD","152":"CHL","156":"CHN","158":"TWN","170":"COL","174":"COM",
        "178":"COG","180":"COD","188":"CRI","191":"HRV","192":"CUB","196":"CYP",
        "203":"CZE","204":"BEN","208":"DNK","212":"DMA","214":"DOM","218":"ECU",
        "222":"SLV","226":"GNQ","231":"ETH","232":"ERI","233":"EST","234":"FRO",
        "242":"FJI","246":"FIN","250":"FRA","258":"PYF","262":"DJI","266":"GAB",
        "268":"GEO","270":"GMB","275":"PSE","276":"DEU","288":"GHA","292":"GIB",
        "296":"KIR","300":"GRC","304":"GRL","308":"GRD","316":"GUM","320":"GTM",
        "324":"GIN","328":"GUY","332":"HTI","340":"HND","344":"HKG","348":"HUN",
        "352":"ISL","356":"IND","360":"IDN","364":"IRN","368":"IRQ","372":"IRL",
        "376":"ISR","380":"ITA","384":"CIV","388":"JAM","392":"JPN","398":"KAZ",
        "400":"JOR","404":"KEN","408":"PRK","410":"KOR","414":"KWT","417":"KGZ",
        "418":"LAO","422":"LBN","426":"LSO","428":"LVA","430":"LBR","434":"LBY",
        "438":"LIE","440":"LTU","442":"LUX","446":"MAC","450":"MDG","454":"MWI",
        "458":"MYS","462":"MDV","466":"MLI","470":"MLT","478":"MRT","480":"MUS",
        "484":"MEX","492":"MCO","496":"MNG","498":"MDA","499":"MNE","504":"MAR",
        "508":"MOZ","512":"OMN","516":"NAM","520":"NRU","524":"NPL","528":"NLD",
        "540":"NCL","548":"VUT","554":"NZL","558":"NIC","562":"NER","566":"NGA",
        "570":"NIU","578":"NOR","586":"PAK","591":"PAN","598":"PNG","600":"PRY",
        "604":"PER","608":"PHL","616":"POL","620":"PRT","630":"PRI","634":"QAT",
        "642":"ROU","643":"RUS","646":"RWA","654":"SHN","659":"KNA","662":"LCA",
        "670":"VCT","674":"SMR","678":"STP","682":"SAU","686":"SEN","688":"SRB",
        "690":"SYC","694":"SLE","702":"SGP","703":"SVK","704":"VNM","705":"SVN",
        "706":"SOM","710":"ZAF","716":"ZWE","724":"ESP","728":"SSD","729":"SDN",
        "732":"ESH","740":"SUR","748":"SWZ","752":"SWE","756":"CHE","760":"SYR",
        "762":"TJK","764":"THA","768":"TGO","776":"TON","780":"TTO","784":"ARE",
        "788":"TUN","792":"TUR","795":"TKM","798":"TUV","800":"UGA","804":"UKR",
        "807":"MKD","818":"EGY","826":"GBR","834":"TZA","840":"USA","854":"BFA",
        "858":"URY","860":"UZB","862":"VEN","887":"YEM","894":"ZMB",
    }


# ============================================================================
# Offshoring Destination Scores
# ============================================================================
# Which countries are most likely to RECEIVE offshored work?
# Score based on: labor cost advantage × AI tool adoption × English proficiency
#                 × tech infrastructure × timezone overlap with US
# Scale 0-1. Higher = more attractive offshoring destination.
# Source: World Bank labor costs, EF English Proficiency Index, ITU ICT index.

# ============================================================================
# Country-specific AI exposure overrides
# ============================================================================
# For countries where the generic sector-based estimate is known to be
# inaccurate due to country-specific AI deployment patterns.
# Score replaces the Tier 2 sector-based calculation.
COUNTRY_EXPOSURE_OVERRIDES = {
    "CHN": {
        "score": 0.48,
        "reason": (
            "China's sector-based estimate understates actual AI deployment. "
            "Massive government-directed AI investment, extensive surveillance "
            "infrastructure (facial recognition, social credit), advanced "
            "manufacturing automation (world's largest robot installer per IFR), "
            "dominant fintech/e-commerce AI deployment (Alibaba, Tencent, ByteDance). "
            "Services sector at 55% is heavily AI-augmented. Manufacturing sector "
            "has higher automation than global average."
        ),
    },
    "KOR": {
        "score": 0.51,
        "reason": (
            "South Korea has the highest robot density in the world (IFR 2023). "
            "Samsung, LG, Hyundai heavily deploying AI across manufacturing and services. "
            "Sector-based estimate misses the intensity of Korean AI adoption."
        ),
    },
    "ISR": {
        "score": 0.52,
        "reason": (
            "Israel's tech sector is disproportionately large relative to employment "
            "categories. Massive AI startup ecosystem, military AI applications, "
            "and high-tech services concentration."
        ),
    },
}

OFFSHORING_DESTINATION_SCORES = {
    "IND": 0.92,  # India — dominant: low cost, English, massive tech workforce, AI adoption
    "PHL": 0.85,  # Philippines — strong English, BPO industry, AI customer service
    "POL": 0.72,  # Poland — EU timezone, strong tech education, moderate cost
    "VNM": 0.70,  # Vietnam — very low cost, growing tech sector, AI adoption
    "MEX": 0.68,  # Mexico — US timezone, nearshoring, growing tech
    "COL": 0.65,  # Colombia — US timezone, bilingual workforce growing
    "ROU": 0.63,  # Romania — EU, strong IT sector, low cost
    "UKR": 0.60,  # Ukraine — strong developers (reduced by conflict)
    "BGD": 0.58,  # Bangladesh — very low cost, growing digital workforce
    "IDN": 0.55,  # Indonesia — large workforce, improving English
    "BRA": 0.52,  # Brazil — large market, moderate cost, Portuguese barrier
    "ARG": 0.50,  # Argentina — educated workforce, timezone match, economic instability
    "EGY": 0.48,  # Egypt — Arabic/English, young workforce, low cost
    "KEN": 0.45,  # Kenya — English, growing tech hub
    "NGA": 0.42,  # Nigeria — English, large youth population, infrastructure challenges
    "MYS": 0.55,  # Malaysia — English, moderate cost, tech infrastructure
    "SGP": 0.40,  # Singapore — high cost but excellent infrastructure (hub, not destination)
    "THA": 0.45,  # Thailand — moderate cost, tourism-oriented economy
    "PAK": 0.55,  # Pakistan — English, low cost, growing freelance/IT sector
    "LKA": 0.50,  # Sri Lanka — English, educated, recent economic recovery
    "CZE": 0.48,  # Czech Republic — EU, skilled, moderate cost
    "HUN": 0.45,  # Hungary — EU, skilled
    "CHL": 0.42,  # Chile — stable, US timezone
    "PER": 0.38,  # Peru — lower cost, Spanish
    "ZAF": 0.45,  # South Africa — English, timezone overlap with EU
    "GHA": 0.40,  # Ghana — English, growing tech
    "MAR": 0.42,  # Morocco — French/Arabic, EU nearshoring
    "TUN": 0.38,  # Tunisia — French, EU proximity
    "ETH": 0.30,  # Ethiopia — low cost but infrastructure challenges
    "CHN": 0.35,  # China — capable but geopolitical barriers reduce score
    # High-income countries: low offshoring destination score
    "USA": 0.05, "GBR": 0.10, "DEU": 0.08, "FRA": 0.08, "JPN": 0.05,
    "CAN": 0.12, "AUS": 0.08, "CHE": 0.03, "NOR": 0.03, "SWE": 0.06,
}


def compute_all_country_scores():
    """
    Compute AI exposure for every country in the world.

    Returns list of dicts ready for database insertion.
    """
    print("Computing international AI exposure scores...")

    numeric_to_iso3 = _load_numeric_to_iso3()
    iso3_to_numeric = {v: k for k, v in numeric_to_iso3.items()}

    # Load World Bank data
    wb_path = RAW_DIR / "worldbank_sectors.json"
    if not wb_path.exists():
        raise FileNotFoundError(f"World Bank data not found at {wb_path}. Run download first.")

    with open(wb_path) as f:
        wb_data = json.load(f)

    wb_by_iso3 = {d["iso3"]: d for d in wb_data if d.get("iso3")}

    results = []
    tier1_count = 0
    tier2_count = 0
    tier3_count = 0

    # Process all countries that exist in our numeric→iso3 mapping
    all_iso3 = set(numeric_to_iso3.values())

    for iso3 in sorted(all_iso3):
        # Tier 1: OECD with full ISCO data
        if iso3 in OECD_COUNTRY_DATA:
            data = OECD_COUNTRY_DATA[iso3]
            score = sum(
                share * ISCO_EXPOSURE[isco]["ai_exposure"]
                for isco, share in data["isco_shares"].items()
            )

            top_occs = [
                {
                    "name": ISCO_EXPOSURE[isco]["name"],
                    "share": share,
                    "ai_exposure": ISCO_EXPOSURE[isco]["ai_exposure"],
                }
                for isco, share in sorted(
                    data["isco_shares"].items(),
                    key=lambda x: ISCO_EXPOSURE[x[0]]["ai_exposure"],
                    reverse=True,
                )
            ]

            results.append({
                "iso3": iso3,
                "numeric_id": iso3_to_numeric.get(iso3, ""),
                "name": data["name"],
                "ai_exposure_score": round(score, 4),
                "total_employment": data["total_employment"],
                "data_tier": "tier1",
                "source": data["source"],
                "year": data["year"],
                "top_occupations": top_occs,
            })
            tier1_count += 1
            continue

        # Tier 2: World Bank sector data
        wb = wb_by_iso3.get(iso3)
        if wb and all(k in wb for k in ["agri_employment_pct", "industry_employment_pct", "services_employment_pct"]):
            agri = wb["agri_employment_pct"] / 100
            industry = wb["industry_employment_pct"] / 100
            services = wb["services_employment_pct"] / 100

            # Normalize in case they don't sum to 1
            total = agri + industry + services
            if total > 0:
                agri /= total
                industry /= total
                services /= total

            score = (
                agri * SECTOR_EXPOSURE["agriculture"] +
                industry * SECTOR_EXPOSURE["industry"] +
                services * SECTOR_EXPOSURE["services"]
            )

            # Apply country-specific override if available
            if iso3 in COUNTRY_EXPOSURE_OVERRIDES:
                score = COUNTRY_EXPOSURE_OVERRIDES[iso3]["score"]

            labor_force = wb.get("labor_force", wb.get("population", 0))
            if labor_force and labor_force > 0:
                employment = int(labor_force)
            else:
                employment = 0

            top_occs = [
                {"name": "Services sector", "share": services, "ai_exposure": SECTOR_EXPOSURE["services"]},
                {"name": "Industry sector", "share": industry, "ai_exposure": SECTOR_EXPOSURE["industry"]},
                {"name": "Agriculture sector", "share": agri, "ai_exposure": SECTOR_EXPOSURE["agriculture"]},
            ]

            results.append({
                "iso3": iso3,
                "numeric_id": iso3_to_numeric.get(iso3, ""),
                "name": wb.get("name", iso3),
                "ai_exposure_score": round(score, 4),
                "total_employment": employment,
                "data_tier": "tier2",
                "source": "World Bank Development Indicators",
                "year": wb.get("agri_employment_pct_year", 2022),
                "top_occupations": top_occs,
            })
            tier2_count += 1
            continue

        # Tier 3: No data
        name = wb["name"] if wb else iso3
        results.append({
            "iso3": iso3,
            "numeric_id": iso3_to_numeric.get(iso3, ""),
            "name": name,
            "ai_exposure_score": None,
            "total_employment": 0,
            "data_tier": "tier3",
            "source": "Insufficient data",
            "year": None,
            "top_occupations": [],
        })
        tier3_count += 1

    # Add offshoring destination scores
    for r in results:
        r["offshoring_destination_score"] = OFFSHORING_DESTINATION_SCORES.get(r["iso3"], 0.20)

    # Compute percentiles (only for countries WITH scores)
    scored = [r for r in results if r["ai_exposure_score"] is not None]
    scores = sorted(r["ai_exposure_score"] for r in scored)
    for r in results:
        if r["ai_exposure_score"] is not None:
            rank = sum(1 for s in scores if s <= r["ai_exposure_score"])
            r["exposure_percentile"] = round(rank / len(scores) * 100, 1)
        else:
            r["exposure_percentile"] = None

    print(f"  Tier 1 (OECD, full ISCO): {tier1_count}")
    print(f"  Tier 2 (World Bank sectors): {tier2_count}")
    print(f"  Tier 3 (no data): {tier3_count}")
    print(f"  Total: {len(results)}")

    # Show top/bottom
    scored.sort(key=lambda x: x["ai_exposure_score"], reverse=True)
    print(f"\n  Top 10 most AI-exposed:")
    for r in scored[:10]:
        tier_label = "OECD" if r["data_tier"] == "tier1" else "est."
        print(f"    {r['iso3']} {r['name']}: {r['ai_exposure_score']:.3f} [{tier_label}]")
    print(f"\n  Bottom 10 least AI-exposed:")
    for r in scored[-10:]:
        tier_label = "OECD" if r["data_tier"] == "tier1" else "est."
        print(f"    {r['iso3']} {r['name']}: {r['ai_exposure_score']:.3f} [{tier_label}]")

    return results


def write_international_to_sqlite():
    """Write all country scores to the database."""
    results = compute_all_country_scores()

    conn = sqlite3.connect(DB_PATH)

    rows = []
    for c in results:
        rows.append({
            "iso3": c["iso3"],
            "numeric_id": c["numeric_id"],
            "name": c["name"],
            "ai_exposure_score": c["ai_exposure_score"],
            "total_employment": c["total_employment"],
            "exposure_percentile": c["exposure_percentile"],
            "data_tier": c["data_tier"],
            "year": c["year"],
            "source": c["source"],
            "top_occupations_json": json.dumps(c["top_occupations"]),
            "offshoring_destination_score": c.get("offshoring_destination_score", 0.20),
        })

    df = pd.DataFrame(rows)
    df.to_sql("country_scores", conn, if_exists="replace", index=False)
    conn.commit()
    print(f"\n  Written {len(rows)} countries to database")
    conn.close()


if __name__ == "__main__":
    write_international_to_sqlite()
