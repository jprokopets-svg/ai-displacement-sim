"""Database connection and query helpers."""
import sqlite3
from contextlib import contextmanager
from typing import Optional, List, Dict
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "processed" / "displacement.db"


@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def get_all_county_scores() -> List[Dict]:
    """Get all county exposure scores for the map."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT county_fips, county_name, ai_exposure_score,
                   total_employment, exposed_employment,
                   mean_wage_weighted, exposure_percentile, n_occupations,
                   CASE WHEN is_estimated = 1 THEN 1 ELSE 0 END as is_estimated
            FROM county_scores
            ORDER BY ai_exposure_score DESC
            """
        ).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["is_estimated"] = bool(d.get("is_estimated", 0))
        results.append(d)
    return results


def get_county_detail(county_fips: str) -> Optional[Dict]:
    """Get detailed data for a single county including top occupations."""
    with get_db() as conn:
        # County aggregate
        county = conn.execute(
            "SELECT * FROM county_scores WHERE county_fips = ?",
            (county_fips,),
        ).fetchone()

        if not county:
            return None

        # Top occupations by exposure (most vulnerable)
        top_exposed = conn.execute(
            """
            SELECT soc_code, occupation_title, employment, ai_exposure, mean_wage
            FROM county_occupations
            WHERE county_fips = ?
            ORDER BY ai_exposure DESC
            LIMIT 20
            """,
            (county_fips,),
        ).fetchall()

        # Top occupations by employment (largest)
        top_employment = conn.execute(
            """
            SELECT soc_code, occupation_title, employment, ai_exposure, mean_wage
            FROM county_occupations
            WHERE county_fips = ?
            ORDER BY employment DESC
            LIMIT 20
            """,
            (county_fips,),
        ).fetchall()

    return {
        "county": dict(county),
        "top_exposed_occupations": [dict(r) for r in top_exposed],
        "top_employment_occupations": [dict(r) for r in top_employment],
    }


def search_occupation(query: str) -> List[Dict]:
    """Search occupations by title. Supports comma-separated multi-term search.

    Uses word-boundary-aware matching: each search term must match as a whole
    word (or the start of a word) in the occupation title, not just appear as a
    substring.  This prevents e.g. "consultant" from matching "conductors".
    Results are ranked so that exact/start-of-word matches sort above partial
    matches.
    """
    terms = [t.strip() for t in query.split(",") if t.strip()]
    if not terms:
        return []

    with get_db() as conn:
        # Fetch all occupations and do smarter matching in Python so we can
        # apply word-boundary logic that SQLite LIKE cannot express.
        all_rows = conn.execute(
            "SELECT soc_code, occupation_title, ai_exposure FROM occupation_exposure"
        ).fetchall()

    terms_lower = [t.lower() for t in terms]
    results: List[Dict] = []

    for r in all_rows:
        title_lower = (r["occupation_title"] or "").lower()
        words = title_lower.replace(",", " ").replace("-", " ").replace("/", " ").split()

        matched = False
        score = 0  # higher = better match quality
        for term in terms_lower:
            # Check if any word in the title starts with the search term
            for w in words:
                if w == term:
                    matched = True
                    score += 3  # exact word match
                    break
                if w.startswith(term):
                    matched = True
                    score += 2  # prefix match
                    break
            else:
                # Fallback: check if the full term appears in the title
                # (handles multi-word terms like "food service")
                if term in title_lower:
                    matched = True
                    score += 1

        if matched:
            d = dict(r)
            d["_match_score"] = score
            results.append(d)

    # Sort by match quality descending, then by ai_exposure descending
    results.sort(key=lambda x: (-x.pop("_match_score", 0), -(x.get("ai_exposure") or 0)))
    return results[:50]


def get_occupation_detail(soc_code: str) -> Optional[Dict]:
    """Get detailed exposure data for a single occupation."""
    with get_db() as conn:
        occ = conn.execute(
            "SELECT * FROM occupation_exposure WHERE soc_code = ?",
            (soc_code,),
        ).fetchone()

        if not occ:
            return None

        # Counties where this occupation is most concentrated
        top_counties = conn.execute(
            """
            SELECT county_fips, county_name, employment, ai_exposure, mean_wage
            FROM county_occupations
            WHERE soc_code = ?
            ORDER BY employment DESC
            LIMIT 20
            """,
            (soc_code,),
        ).fetchall()

    return {
        "occupation": dict(occ),
        "top_counties": [dict(r) for r in top_counties],
    }


def get_all_country_scores() -> List[Dict]:
    """Get all international country exposure scores."""
    import json as _json
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM country_scores ORDER BY ai_exposure_score DESC NULLS LAST"
        ).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["top_occupations"] = _json.loads(d.pop("top_occupations_json", "[]"))
        results.append(d)
    return results


def get_county_overlays() -> Dict:
    """Get all overlay data keyed by county FIPS for the frontend."""
    import json as _json
    with get_db() as conn:
        # Dynamics: cascade, reshoring paradox, manufacturing
        dynamics = {}
        try:
            for r in conn.execute(
                """SELECT county_fips, cascade_score, reshoring_paradox_score,
                          manufacturing_emp_pct, small_biz_concentration,
                          sector_ai_pressure, consumer_facing_pct
                   FROM county_dynamics"""
            ):
                dynamics[r["county_fips"]] = dict(r)
        except Exception:
            pass

        # Government floor: transfer payments, govt employment
        govt = {}
        try:
            for r in conn.execute(
                """SELECT county_fips, govt_floor_score, govt_pct, federal_pct,
                          transfer_pct, transfer_dependency_label
                   FROM county_govt_floor"""
            ):
                govt[r["county_fips"]] = dict(r)
        except Exception:
            pass

        # K-shape: equity/wage ratio, scores
        kshape = {}
        try:
            for r in conn.execute(
                """SELECT county_fips, kshape_score, equity_insulation,
                          equity_fragility, equity_wage_ratio,
                          per_capita_income, gini_coefficient
                   FROM county_kshape"""
            ):
                kshape[r["county_fips"]] = dict(r)
        except Exception:
            pass

        # Multi-track scores (cognitive, robotics, agentic, offshoring per county)
        multi_track = {}
        try:
            for r in conn.execute(
                """SELECT county_fips, cognitive_score, robotics_score,
                          agentic_score, offshoring_score, regulatory_friction,
                          fragility_score
                   FROM multi_track_scores"""
            ):
                multi_track[r["county_fips"]] = dict(r)
        except Exception:
            pass

    return {
        "dynamics": dynamics,
        "govt_floor": govt,
        "kshape": kshape,
        "multi_track": multi_track,
    }


def get_company_displacement() -> List[Dict]:
    """Load company displacement data from the scraper export."""
    import json as _json
    from pathlib import Path
    path = Path(__file__).parent.parent / "data" / "company_displacement.json"
    if not path.exists():
        return []
    with open(path) as f:
        data = _json.load(f)
    return data.get("companies", [])


def get_model_assumptions() -> List[Dict]:
    """Get all documented model assumptions."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM model_assumptions").fetchall()
    return [dict(r) for r in rows]
