# AI Workforce Displacement Simulator

A comprehensive, interactive tool for modeling AI-driven workforce displacement across US counties and internationally. Built with a multi-track displacement model (cognitive AI, industrial robotics, agentic AI, offshoring acceleration), six economic dynamics (competitive cascade, trade policy, K-shape wealth effect, AI equity loop, government demand floor, deficit/profit scenarios), and a Monte Carlo simulation engine that produces probability distributions — not point predictions. Pairs with a Substack series on AI's macroeconomic impact.

## Key Features

- **US county choropleth map** — 3,204 counties colored by AI displacement risk, zoom/pan, click for detailed breakdown
- **4-track displacement model** — cognitive AI, industrial robotics, agentic AI, and offshoring acceleration with independent time scaling
- **6 economic dynamics** — competitive cascade, trade policy scenarios, K-shape wealth effect, AI equity reflexive loop, government demand floor, deficit spiral vs corporate profit surge
- **Year slider (2025-2040)** — visual uncertainty system with progressive opacity, hatch patterns, confidence interval widening, and time-band banners
- **Monte Carlo simulation** — 50,000 runs per parameter set with trade policy, equity loop, feedback aggressiveness, and government response scenarios
- **World map** — 203 countries with AI exposure scores and offshoring destination scoring
- **Job search** — look up any occupation's AI displacement score with full track breakdown
- **Company displacement layer** — 22 verified companies with documented AI workforce actions, confidence-scored evidence with source citations
- **Control panel** — year slider, feedback loop aggressiveness (with author prediction marker), trade policy, corporate profit scenario, equity loop toggle, 8 map layers, 4 overlay toggles

## Data Sources

| Source | Data | Usage |
|--------|------|-------|
| O*NET 29.1 | Abilities, Work Activities, Work Context | Core AIOE computation, task pipeline, output verifiability |
| BLS OEWS May 2024 | MSA employment by occupation | County occupation employment |
| BLS QCEW 2023 | County employment by industry + ownership | MSA crosswalk, small business concentration, government employment |
| Census ACS 2022 | Income, Gini coefficient, transfer payments | K-shape wealth effect, government floor, transfer dependency |
| Felten, Raj, Seamans (2021) | AI capability scores per O*NET ability | Track 1 cognitive AI exposure |
| Frey & Osborne (2017) | Automation probability by occupation | Track 1 physical automation component |
| World Bank Development Indicators | Employment by sector, labor force | International country scores |
| IFR World Robotics Report | Robot density by industry | Track 2 robotics calibration |
| Blinder-Krueger (2013) | Occupational tradability index | Track 4 offshoring acceleration |
| Company displacement scraper | SEC 8-K filings, news, earnings calls | Deployment evidence scores |

## Methodology

Full documentation at [docs/methodology.md](docs/methodology.md), covering:
- All four displacement tracks with weights, data sources, and time scaling functions
- All six economic dynamics with mechanisms and calibration
- The two main scenarios (corporate profit surge vs deficit spiral)
- Visual uncertainty system and confidence interval computation
- Feedback loop aggressiveness slider mechanics
- All known limitations (9 documented)

## How to Run Locally

### Prerequisites
- Python 3.9+
- Node.js 18+

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Download and process data (OEWS requires manual browser download — see pipeline instructions)
cd ..
python -m backend.data.scripts.run_pipeline all

# Compute multi-track scores
python -m backend.data.scripts.composite_score
python -m backend.data.scripts.multi_track
python -m backend.data.scripts.fill_rural
python -m backend.data.scripts.economic_dynamics
python -m backend.data.scripts.kshape_equity
python -m backend.data.scripts.government_floor
python -m backend.data.scripts.international

# Start API server
uvicorn backend.app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Author

**Jake Prokopets**

## Disclaimer

This tool is a structural analysis of AI-driven workforce displacement for educational and research purposes. It is not investment advice, employment guidance, or a policy recommendation. All projections carry uncertainty that increases with time horizon — the model makes this uncertainty visible through confidence intervals, opacity changes, and explicit labeling. Scores are based on published academic research, government data, and documented corporate actions, but the composite methodology involves calibrated assumptions that are documented in [methodology.md](docs/methodology.md). No output should be interpreted as a precise prediction. Use as a framework for thinking about scenarios, not as a forecast.
