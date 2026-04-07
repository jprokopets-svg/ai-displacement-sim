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
                   mean_wage_weighted, exposure_percentile, n_occupations
            FROM county_scores
            ORDER BY ai_exposure_score DESC
            """
        ).fetchall()
    return [dict(r) for r in rows]


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
    """Search occupations by title and return exposure scores."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT soc_code, occupation_title, ai_exposure
            FROM occupation_exposure
            WHERE occupation_title LIKE ?
            ORDER BY ai_exposure DESC
            LIMIT 20
            """,
            (f"%{query}%",),
        ).fetchall()
    return [dict(r) for r in rows]


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


def get_model_assumptions() -> List[Dict]:
    """Get all documented model assumptions."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM model_assumptions").fetchall()
    return [dict(r) for r in rows]
