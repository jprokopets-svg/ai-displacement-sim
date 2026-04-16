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
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .database import (
    get_all_county_scores,
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "https://*.vercel.app"],
    allow_origin_regex=r"https://.*\.vercel\.app",
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
    return {"counties": scores, "count": len(scores)}


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
    """Company displacement data with office locations."""
    companies = get_company_displacement()
    return {"companies": companies, "count": len(companies)}


@app.get("/api/signals")
def signals():
    """Top pending items from the scraper pipeline, exported as a static snapshot."""
    path = Path(__file__).parent.parent / "data" / "signals.json"
    if not path.exists():
        return {"signals": [], "count": 0}
    import json as _json
    data = _json.loads(path.read_text())
    return data


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
    }
