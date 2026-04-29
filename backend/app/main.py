"""
FastAPI application for AI Workforce Displacement Simulator.

Endpoints:
    GET  /api/counties              — All county exposure scores (for map)
    GET  /api/counties/{fips}       — Detail for a single county
    GET  /api/occupations/search    — Search occupations by name
    GET  /api/occupations/{soc}     — Detail for a single occupation
    POST /api/simulate              — Run Monte Carlo simulation
    GET  /api/assumptions           — Model assumptions and methodology
    GET  /api/health                — Health check
"""
import json as _json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .database import (
    get_all_county_scores,
    get_bartik_adjustments,
    get_bucket_boundaries,
    get_county_detail,
    search_occupation,
    get_occupation_detail,
    get_model_assumptions,
    get_all_country_scores,
    get_county_overlays,
    get_company_displacement,
)
from .models import SimulationParams, SimulationResult
from .simulation import run_simulation

app = FastAPI(
    title="AI Workforce Displacement Simulator",
    description="Monte Carlo simulation of AI-driven job displacement at the US county level",
    version="0.1.0",
)


@app.on_event("startup")
def _startup():
    """Run initial signal fetch and start scheduler on deploy."""
    import logging
    try:
        from .news_fetcher import fetch_live_signals, start_signal_scheduler
        fetch_live_signals()
        start_signal_scheduler()
    except Exception as e:
        logging.warning(f"Signal fetcher startup failed (non-fatal): {e}")

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yourjobrisk.com",
        "https://www.yourjobrisk.com",
        "https://ai-displacement-sim-4x9g.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/counties")
def list_counties():
    """All county exposure scores for the choropleth map."""
    scores = get_all_county_scores()
    if not scores:
        raise HTTPException(status_code=503, detail="No data loaded. Run the data pipeline first.")
    return {
        "counties": scores,
        "count": len(scores),
        "bucket_boundaries": get_bucket_boundaries(),
        "bartik": get_bartik_adjustments(),
    }


@app.get("/api/counties/{county_fips}")
def county_detail(county_fips: str):
    """Detailed data for a single county including top occupations."""
    detail = get_county_detail(county_fips)
    if not detail:
        raise HTTPException(status_code=404, detail=f"County {county_fips} not found")
    return detail


@app.get("/api/countries")
def list_countries():
    """International country-level AI exposure scores."""
    scores = get_all_country_scores()
    return {"countries": scores, "count": len(scores)}


@app.get("/api/overlays")
def county_overlays():
    """All county overlay data: dynamics, govt floor, K-shape."""
    return get_county_overlays()


@app.get("/api/companies")
def company_data():
    """Company displacement data from company_displacement.json.
    Read fresh on every request — no DB caching."""
    from fastapi.responses import JSONResponse
    companies = get_company_displacement()
    total_events = sum(len(c.get('displacement_events', [])) for c in companies)
    total_jobs = sum(c.get('total_headcount_impacted') or 0 for c in companies)
    return JSONResponse(
        content={"companies": companies, "count": len(companies),
                 "total_events": total_events, "total_jobs": total_jobs},
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


@app.get("/api/admin/reseed")
def admin_reseed():
    """Emergency endpoint — confirms JSON file state. No actual DB to reseed;
    companies are read from JSON on every request."""
    companies = get_company_displacement()
    total_events = sum(len(c.get('displacement_events', [])) for c in companies)
    return {
        "status": "ok",
        "message": "company_displacement.json read successfully",
        "companies": len(companies),
        "events": total_events,
        "note": "No SQLite seeding needed — companies are served directly from JSON file",
    }


@app.get("/api/signals")
def signals():
    """Live news signals from NewsAPI + scraper fallback.
    Layer 1: NewsAPI live fetch (cached in signals.json).
    Layer 2: Static scraper snapshot fallback."""
    import sqlite3
    import logging
    import os

    # Try live NewsAPI signals first
    signals_cache = Path(__file__).parent.parent / "data" / "signals_live.json"
    if signals_cache.exists():
        try:
            data = _json.loads(signals_cache.read_text())
            if data.get("signals") and len(data["signals"]) > 0:
                return data
        except Exception:
            pass

    # Try scraper DB
    scraper_db = Path.home() / "projects" / "ai-displacement-scraper" / "data" / "companies.db"
    if scraper_db.exists():
        try:
            conn = sqlite3.connect(str(scraper_db))
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """SELECT id, raw_text, source_url, assigned_confidence as confidence,
                          date_found as found_at, status
                   FROM manual_queue WHERE status = 'pending'
                   ORDER BY assigned_confidence DESC, id DESC LIMIT 20"""
            ).fetchall()
            conn.close()
            result = [dict(r) for r in rows]
            return {"signals": result, "count": len(result), "source": "live"}
        except Exception as e:
            logging.warning(f"Failed to read scraper DB: {e}")

    # Fallback to static snapshot
    path = Path(__file__).parent.parent / "data" / "signals.json"
    if not path.exists():
        return {"signals": [], "count": 0, "source": "empty"}
    data = _json.loads(path.read_text())
    data["source"] = "static"
    return data


@app.get("/api/news/latest")
def news_latest(since: int = Query(0, description="Epoch milliseconds — return events after this timestamp")):
    """Returns company displacement events added after the given timestamp.
    Used by the frontend polling mechanism to detect new events."""
    from datetime import datetime
    companies = get_company_displacement()
    since_date = datetime.fromtimestamp(since / 1000).strftime('%Y-%m-%d') if since > 0 else '2000-01-01'
    new_events = []
    for c in companies:
        for ev in (c.get('displacement_events') or []):
            if (ev.get('date') or '') > since_date:
                new_events.append({
                    'company': c.get('name'),
                    'date': ev.get('date'),
                    'headcount_impact': ev.get('headcount_impact'),
                    'description': ev.get('description'),
                })
    total_new_jobs = sum(e.get('headcount_impact') or 0 for e in new_events)
    return {
        'events': new_events[:20],
        'count': len(new_events),
        'newJobsCount': total_new_jobs,
        'timestamp': int(datetime.now().timestamp() * 1000),
    }


@app.get("/api/occupations/search")
def occupation_search(q: str = Query(..., min_length=2, description="Search query")):
    """Search occupations by title."""
    results = search_occupation(q)
    return {"occupations": results, "count": len(results)}


@app.get("/api/occupations/{soc_code}")
def occupation_detail(soc_code: str):
    """Detailed exposure data for a single occupation."""
    detail = get_occupation_detail(soc_code)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Occupation {soc_code} not found")
    return detail


@app.post("/api/simulate", response_model=SimulationResult)
def simulate(params: SimulationParams):
    """
    Run Monte Carlo simulation with the given parameters.

    Returns probability distributions across N simulations, not point predictions.
    Confidence intervals are always included.
    """
    result = run_simulation(params)
    return result


@app.get("/api/assumptions")
def assumptions():
    """Model assumptions, data sources, and methodology notes."""
    return {
        "assumptions": get_model_assumptions(),
        "data_sources": [
            {
                "name": "O*NET",
                "version": "29.1",
                "url": "https://www.onetcenter.org/database.html",
                "description": "Occupational task composition database",
            },
            {
                "name": "Felten-Raj-Rock AI Exposure Index",
                "version": "2021 update",
                "citation": (
                    "Felten, E., Raj, M., & Seamans, R. (2021). "
                    "Occupational, Industry, and Geographic Exposure to "
                    "Artificial Intelligence: A Novel Indicators, Revisited."
                ),
                "description": "AI exposure score per occupation based on task-AI overlap",
            },
            {
                "name": "BLS OEWS",
                "version": "May 2023",
                "url": "https://www.bls.gov/oes/",
                "description": "MSA-level employment by occupation",
            },
            {
                "name": "BLS QCEW",
                "version": "2023 Annual",
                "url": "https://www.bls.gov/cew/",
                "description": "County-level total employment (used for MSA-to-county crosswalk)",
            },
        ],
        "methodology_notes": [
            "County-level occupation estimates use MSA-to-county QCEW employment share crosswalk (approximation)",
            "AI exposure is task-weighted, not binary displacement prediction",
            "Monte Carlo engine uses empirically-sourced elasticities with stochastic variation",
            "All outputs are probability distributions with explicit confidence intervals",
        ],
        "simulation_assumptions": {
            "framing": (
                "Models displacement from adoption of current AI capabilities. "
                "Does not model future capability improvements."
            ),
            "exposure_source": "Eloundou et al. 2024 GPT-4 task exposure scores (frozen at 2024 capability levels)",
            "s_curve": "Represents deployment/adoption pace of existing capabilities, not capability growth",
            "feedback_cascade": "Economic self-reinforcement (displacement causing more displacement via demand reduction). Distinct from capability growth.",
            "capability_growth": "Not modeled. If AI capabilities improve beyond GPT-4 levels, actual displacement will exceed simulation output.",
        },
    }
