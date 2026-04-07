# AI Workforce Displacement Simulator

Interactive US map visualizing AI-driven job displacement at the county level, with a Monte Carlo simulation engine that models downstream economic and policy responses.

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Set up the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Download and process data

```bash
# From project root
python -m backend.data.scripts.run_pipeline all
```

This downloads O*NET, Felten-Raj-Rock, and BLS data, then produces county-level AI exposure scores in `backend/data/processed/displacement.db`.

### 3. Start the backend

```bash
uvicorn backend.app.main:app --reload
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI endpoints
│   │   ├── database.py      # SQLite queries
│   │   ├── models.py        # Pydantic schemas
│   │   └── simulation.py    # Monte Carlo engine
│   ├── data/
│   │   ├── raw/             # Downloaded source data (gitignored)
│   │   ├── processed/       # SQLite database (gitignored)
│   │   └── scripts/         # Download and processing pipeline
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── USMap.tsx         # D3/TopoJSON choropleth
│       │   ├── CountyPanel.tsx   # County detail sidebar
│       │   ├── SimulationPanel.tsx # Monte Carlo controls + results
│       │   └── JobSearch.tsx     # Occupation lookup
│       ├── utils/
│       │   ├── api.ts        # Backend API client
│       │   └── colors.ts     # Exposure color scale
│       └── App.tsx
└── docs/
    └── methodology.md       # Full model documentation
```

## Data Sources

| Source | Version | Purpose |
|--------|---------|---------|
| O*NET | 29.1 | Occupational task composition |
| Felten-Raj-Rock | 2021 update | AI exposure scores per occupation |
| BLS OEWS | May 2023 | MSA-level employment by occupation |
| BLS QCEW | 2023 Annual | County employment (for MSA crosswalk) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/counties` | All county exposure scores |
| GET | `/api/counties/{fips}` | County detail with top occupations |
| GET | `/api/occupations/search?q=` | Search occupations |
| GET | `/api/occupations/{soc}` | Occupation detail |
| POST | `/api/simulate` | Run Monte Carlo simulation |
| GET | `/api/assumptions` | Model methodology and sources |

## Methodology

See [docs/methodology.md](docs/methodology.md) for full documentation of data sources, model assumptions, elasticities, and known limitations.

All outputs are probability distributions with confidence intervals. No point predictions.
