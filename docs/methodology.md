# Methodology

## Data Sources

### O*NET (Version 29.1)
- **Source**: [O*NET Resource Center](https://www.onetcenter.org/database.html)
- **Contents**: Task-level descriptions and ratings for 1,000+ occupations
- **Usage**: Provides the task composition that Felten-Raj-Rock scores are computed against

### AI Occupational Exposure Index (AIOE) — Computed from O*NET
- **Based on**: Felten, E., Raj, M., & Seamans, R. (2021). "Occupational, Industry, and Geographic Exposure to Artificial Intelligence: A Novel Indicators, Revisited."
- **Implementation**: We compute the AIOE directly from O*NET 29.1 Abilities data rather than using a pre-computed download. No reliable authoritative download of the pre-computed scores exists; implementing the methodology directly is both more transparent and more reproducible.
- **Range**: Normalized to [0, 1] across all occupations
- **Important**: Measures task-AI *overlap*, not displacement probability. A score of 0.8 means 80% of the occupation's tasks overlap with current AI capabilities, not that 80% of workers will be displaced.

#### AIOE Computation Method

The AIOE for each occupation is a weighted average of AI capability scores across the 52 O*NET abilities:

```
AIOE(occupation) = Σ_a [ importance(occupation, a) × ai_score(a) ]
                   ─────────────────────────────────────────────────
                        Σ_a [ importance(occupation, a) ]
```

**O*NET data used**: `Abilities.txt`, filtered to Scale ID = "IM" (Importance, 1–5 scale). Each row rates how important a specific ability is for a specific occupation. Element IDs (e.g., `1.A.1.a.1` = Oral Comprehension) identify the 52 abilities.

**AI capability scores**: From the Felten-Raj-Seamans paper's Table 1, stored in `config.py` as `FELTEN_AI_ABILITY_SCORES`. These map each O*NET ability to a 0–1 score reflecting how prevalent AI applications are that utilize that ability. Examples:

| Ability | Element ID | AI Score | Rationale |
|---------|-----------|----------|-----------|
| Written Comprehension | 1.A.1.a.2 | 0.80 | NLP, document analysis |
| Mathematical Reasoning | 1.A.1.c.1 | 0.75 | Symbolic math, theorem provers |
| Inductive Reasoning | 1.A.1.b.5 | 0.70 | Pattern recognition, ML |
| Manual Dexterity | 1.A.2.a.2 | 0.18 | Limited robotic manipulation |
| Static Strength | 1.A.3.a.1 | 0.03 | Minimal AI overlap |

Abilities not in the paper's table are assigned 0 (no known AI application overlap).

**Aggregation to 6-digit SOC**: O*NET uses detailed SOC codes (e.g., `15-1252.00`, `15-1252.01`). Multiple O*NET codes may map to a single 6-digit BLS SOC. We average AIOE across detailed codes to produce one score per 6-digit SOC for BLS matching.

**Validation expectation**: High-AIOE occupations should be cognitive/analytical (financial analysts, actuaries, translators). Low-AIOE occupations should be physical (roofers, athletes, firefighters). If this pattern doesn't hold, the computation has a bug.

### BLS Occupational Employment and Wage Statistics (OEWS)
- **Source**: [BLS OES](https://www.bls.gov/oes/)
- **Version**: May 2023 estimates
- **Level**: Metropolitan Statistical Area (MSA) by SOC occupation code
- **Contents**: Employment counts and wage data per MSA-occupation pair
- **Access**: Requires manual browser download (BLS blocks programmatic access). File: `oesm23ma.zip` from the [special requests page](https://www.bls.gov/oes/tables.htm)

### BLS Quarterly Census of Employment and Wages (QCEW)
- **Source**: [BLS CEW](https://www.bls.gov/cew/)
- **Version**: 2023 Annual Averages
- **Level**: County-level total employment by industry
- **Usage**: Provides county employment shares for the MSA-to-county crosswalk

### Census Bureau MSA Delineation (via NBER mirror)
- **Source**: [NBER CBSA-FIPS Crosswalk](https://www.nber.org/research/data/census-core-based-statistical-area-cbsa-federal-information-processing-series-fips-county-crosswalk) (mirrors Census Bureau delineation files; original Census URL is no longer accessible)
- **Version**: July 2023
- **Usage**: Maps CBSA (MSA) codes to their constituent FIPS county codes

---

## Key Methodological Choices

### County-Level Estimation (MSA-to-County Crosswalk)

**The problem**: BLS OEWS reports occupation-level employment at the MSA level, not the county level. To build a county-level map, we need to estimate how MSA employment distributes across counties.

**Our approach**: We use QCEW total private employment to compute each county's share of its MSA's employment, then distribute MSA-level occupation counts proportionally.

**Assumption**: The occupation mix within an MSA is roughly uniform across its constituent counties.

**Limitation**: This understates occupational specialization. A county dominated by a university will have more education workers than our model suggests; a county with a military base will have more government workers. This is the standard academic approximation (used by Autor, Dorn, and others) and is acceptable for the broad exposure patterns we're visualizing, but should not be used for individual county-level policy decisions without local validation.

### AI Exposure vs. Displacement

The Felten-Raj-Rock score measures **task exposure** — the overlap between what AI can do and what an occupation requires. This is not the same as displacement.

Reasons a high-exposure occupation may not see proportional job losses:
1. **Complementarity**: AI may augment rather than replace workers (radiologists + AI read more scans, not fewer radiologists)
2. **Implementation friction**: Regulatory, organizational, and cost barriers slow adoption
3. **New task creation**: Historically, automation creates new tasks within occupations even as it eliminates old ones (Acemoglu & Restrepo, 2019)
4. **Labor market institutions**: Unions, licensing, and contracts slow workforce adjustment

Our Monte Carlo simulation uses exposure as an *input* to a displacement model with stochastic factors that account for these moderating effects.

---

## Monte Carlo Simulation Model

### Layer 1: Displacement Model

Displacement_rate = AI_exposure × adoption_curve(pace, year) × stochastic_factor

- **Adoption curve**: Logistic S-curve. At pace=0, 50% adoption at year 15. At pace=1, 50% adoption at year 3.
- **Stochastic factor**: Drawn from Beta(2, 5) distribution — right-skewed, reflecting that most occupations see less displacement than raw exposure would suggest.
- **Cumulative displacement**: New displacement applies only to not-yet-displaced workers, with a 95% cap.

### Layer 2: Economic Response Model

Uses empirically-sourced elasticities:

| Parameter | Value | Source |
|---|---|---|
| Spending-unemployment elasticity | -0.5 | Petev, Pistaferri, Saporta-Eksten (2011) |
| Property-unemployment elasticity | -1.8 | Harding, Rosenblatt, Yao (2009) |
| Tax-GDP elasticity | 1.4 | Dye and McGuire (2001) |
| Okun's coefficient | -2.0 | Ball, Leigh, Loungani (2017) |

**Assumption**: These elasticities, estimated from historical recessions, apply to AI-driven structural change. This is uncertain — AI displacement may be more permanent than cyclical unemployment, potentially amplifying these effects.

### Layer 3: Government Response Model

| Policy | Effect | Source/Basis |
|---|---|---|
| Retraining | 20-40% displacement reduction, 2-year lag | Heckman, LaLonde, Smith (1999) |
| UBI | 30-50% spending preservation, 1-year lag | Marinescu (2018), various pilots |
| Fed cuts | 0.3-0.7% GDP per 100bp | Romer and Romer (2004) |

All ranges are drawn uniformly per simulation, producing a distribution of policy effectiveness.

### Layer 4: Feedback Loops

Policy effects feed back into Layers 1-2:
- Retraining reduces subsequent displacement rates
- UBI preserves consumer spending, moderating the economic cascade
- Fed cuts boost GDP, partially offsetting Okun's Law effects

### Output Interpretation

**Every output is a probability distribution**, not a point prediction. The simulation produces:
- Percentiles (p5, p25, p50, p75, p95) for displacement, unemployment, and GDP impact
- Scenario probabilities (% of simulations in each outcome category)
- Explicit confidence intervals on all displayed metrics
- Full list of assumptions used in each simulation run

---

## Known Limitations

1. **Temporal mismatch**: Employment data (2023), O*NET tasks (29.1), and AI capability scores (2021) are not perfectly synchronized. AI capability has advanced significantly since the Felten-Raj-Rock 2021 benchmarks.

2. **Geographic granularity**: The MSA-to-county crosswalk is an approximation. Rural counties not in any MSA are excluded from the current model.

3. **Sector interactions**: The model treats each occupation independently. In reality, displacement in one sector cascades through supply chains.

4. **Behavioral responses**: Worker migration, retraining choices, and entrepreneurship are not modeled at the individual level.

5. **AI capability trajectory**: The model uses a fixed AI capability profile. In reality, AI capabilities are expanding into new task domains over time.

6. **Historical elasticities in novel conditions**: All economic elasticities are estimated from historical data. An unprecedented AI-driven structural shift may produce different magnitudes.

---

## Reproducibility

- Random seed is fixed (42) for given parameter sets — same inputs produce same outputs
- All source data versions are pinned in `backend/data/scripts/config.py`
- AIOE computed from source data, not from an external pre-computed file — fully reproducible
- AI capability scores for each O*NET ability are stored in `config.py` as `FELTEN_AI_ABILITY_SCORES`
- Every simulation result includes the full list of assumptions and parameter values used
