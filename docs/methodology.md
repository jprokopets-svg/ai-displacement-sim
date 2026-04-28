# Methodology

## Overview

This model estimates AI-driven workforce displacement across US counties and internationally through four displacement tracks, six economic dynamics, and a Monte Carlo simulation engine. Every score is designed to be defensible. Every assumption is documented. Uncertainty is visible and increases with time horizon.

---

## The Four Displacement Tracks

### Track 1 — Cognitive AI (weight: 35% of composite)

Measures digital/intellectual automation risk. Built from seven sub-components:

| Sub-component | Weight | Source |
|---|---|---|
| Felten-Raj-Rock AIOE | 20% | Computed from O*NET 29.1 Abilities × AI capability scores |
| Frey-Osborne automation probability | 15% | "The Future of Employment" (2013/2017) |
| Deployment evidence | 25% | Manually curated from corporate announcements |
| Economic incentive (labor cost %) | 15% | BLS Employer Costs for Employee Compensation |
| Task pipeline (flowchart-ability) | 10% | Derived from O*NET Work Activities |
| Output verifiability | 10% | Derived from O*NET Work Context |
| Regulatory friction | 5% | BLS union membership + licensing (inverted) |

Deployment evidence has the highest sub-weight because revealed corporate action is more predictive than theoretical capability.

### Track 2 — Industrial Robotics (weight: 20% of composite)

Physical automation risk from manufacturing robots, warehouse automation, autonomous vehicles, and agricultural robotics.

**Data**: IFR World Robotics Report robot density by industry, MIT/Oxford Economics displacement estimates.

**Time scaling** (deployment curve):
- 2025: 40% of full score — current deployment (Aurora highway, Amazon warehouses)
- 2027: 60% — regulatory frameworks clarifying
- 2030: 85% — full commercial deployment on major corridors
- 2035: 100% — near-complete for robotics-amenable occupations

**Time-varying regulatory friction** for autonomous vehicles:
- Heavy truck drivers: 0.35 (2025) → 0.25 (2028) → 0.15 (2032) → 0.10 (2035)
- Based on: Aurora/Kodiak commercially operating driverless routes in TX/AZ today; federal framework expected late 2020s.

**Trade policy sensitivity**: Robotics weight increases +50% under escalating tariffs (reshoring paradox — manufacturing returns but automated).

### Track 3 — Agentic AI (weight: 20% of composite)

Forward-looking: multi-step autonomous AI workflows that replace entire job functions, not just individual tasks.

**No published dataset** — scores built from O*NET task complexity analysis + current agentic deployment evidence (Salesforce Agentforce, Harvey AI, CoCounsel, Microsoft Copilot agents).

**Critical time gate**: This track contributes **zero before 2026**, then scales linearly to full weight by 2030. Always labeled "Forward-looking — higher uncertainty" in the UI.

**Highest agentic occupations**: Paralegals (0.90), tax preparers (0.88), customer service (0.85), accountants (0.82), HR specialists (0.80).

### Track 4 — Offshoring Acceleration (weight: 15% of composite)

AI removes coordination friction (translation, formatting, quality verification) that previously limited offshoring.

**Data**: Blinder-Krueger (2013) occupational tradability + World Bank labor cost differentials.

**Key mechanism**: A paralegal job doesn't need AI replacement — it just needs AI to make offshoring viable by handling communication barriers.

**Compounds with Track 1**: High cognitive exposure + high tradability = maximum offshoring risk. The compound bonus adds up to 10% to the composite.

**Trade policy sensitivity**: Offshoring weight increases +30% under free trade, decreases -30% under escalating tariffs.

### Composite Formula

```
raw = T1 × W1 + T2 × W2 + T3 × W3 + T4 × W4
friction_dampener = 1.0 - (regulatory_friction × 0.40)
compound = T1 × T4 × 0.10
composite = raw × friction_dampener + compound
```

Normalized to [0, 1] across all occupations for each year.

---

## The Six Economic Dynamics

### Dynamic 1 — Competitive Cascade

Large company automates → reduces prices → small competitor loses share → small company closes → workers displaced without direct automation.

**Data**: QCEW average employees per establishment (small business proxy) + sector AI competitive pressure index.

**Time lag**: 3-7 years from initial automation to small business closure cascade. The lagged score ramps linearly from year 3 to year 7.

### Dynamic 2 — Trade Policy and Capital Allocation

Three user-selectable scenarios:

| Scenario | Robotics modifier | Offshoring modifier |
|---|---|---|
| Current tariffs | +0% | Baseline |
| Free trade | -15% | +30% |
| Escalating tariffs | +50% | -30% |

**Reshoring paradox**: Under escalating tariffs, manufacturing establishments may increase while manufacturing employment stays flat — jobs return to America but not to Americans. Measured by establishment density vs employment share divergence.

### Dynamic 3 — K-Shape Wealth Effect

Top economy (equity holders) vs bottom economy (wage workers) divergence.

**Data**: Census ACS 2022 — per capita income, median household income, Gini coefficient.

**Equity insulation**: Wealthy counties are buffered short-term by non-wage spending.

**Equity fragility**: Same wealthy counties are vulnerable if the AI equity narrative breaks (Dynamic 4).

### Dynamic 4 — AI Equity Reflexive Loop

**Loop intact**: AI capex → tech earnings → equity prices → wealthy spending → GDP → supports AI narrative.

**Loop breaks**: AI disappoints → earnings miss → equity fall → spending contracts → GDP drops → less AI investment → loop reverses.

This is a **speculative scenario toggle**. Always labeled with: "This is a tail risk scenario, not a base case."

The GDP gap between loop-intact and loop-breaks widens from 0.4% in 2027 to 1.8% in 2037.

### Dynamic 5 — Government Demand Floor

Government spending (17% of GDP + transfer payments) creates a demand floor that doesn't automate at market speed.

**Data**: QCEW own_code 1/2/3 (federal/state/local government employment) + Census ACS B19055/B19056/B19057 (households receiving Social Security, SSI, public assistance).

**Government floor score** = 0.45 × govt employment concentration + 0.25 × federal employment share + 0.30 × transfer payment dependency.

Counties with military bases, federal agencies, and high retiree populations are significantly more insulated. Example: Cumberland County, NC (Fort Liberty) has a floor score of 0.643 vs Macomb County, MI at 0.238.

### Dynamic 6 — Deficit Spiral and Corporate Profit Scenario

**Sub-scenario A — Corporate profit surge**: AI productivity → profit boom → tax revenue surge → government can fund displaced workers → floor holds.

**Sub-scenario B — Deficit spiral**: Displacement outpaces profit growth → deficits rise → Treasury yields rise → crowds out investment → weaker growth → more displacement.

**Probability weighting**: At default settings (feedback aggressiveness 0.5), the model assigns 40% to profit surge, 60% to deficit spiral. This is a calibrated assumption based on historical precedent that profit growth lags displacement by 5-15 years in major technological transitions.

**This is not a prediction.** Both paths are plausible. The feedback aggressiveness slider adjusts this split.

The government floor breaks in the deficit spiral around 2033 (deficit exceeds 10% of GDP). Under profit surge, the floor holds through 2037+.

---

## Year Slider and Visual Uncertainty

| Period | Band | Map Opacity | Hatch | Confidence | CI Multiplier |
|---|---|---|---|---|---|
| 2025-2027 | Near-term (evidence-based) | 100% | None | 90% | 1.0x |
| 2027-2030 | Medium-term | 85% | Subtle | 70% | 1.8x |
| 2030-2035 | Long-term (directional) | 70% | Visible | 50% | 3.0x |
| 2035-2040 | Speculative | 50% | Heavy | 30% | 5.0x |

Confidence intervals widen linearly within each band. The CI multiplier applies to the base ±5% interval.

**Track 3 (Agentic AI)** contributes zero before 2026, scales linearly to 2030.

**Track 2 (Robotics)** follows a separate deployment S-curve: 40% → 60% → 85% → 100%.

---

## Feedback Loop Aggressiveness

The slider controls self-reinforcing displacement dynamics:

- **Left (0.0)** — Goldman Sachs baseline: gradual 10-year transition, effects fade
- **Right (1.0)** — Full cascade: displacement → reduced consumer base → more automation → accelerating cycle
- **Author prediction marker at 0.75** — the author's personal assessment

The slider affects medium and long-term projections only. Near-term is evidence-based regardless.

---

## World Map: Offshoring Destination Scoring

Countries scored 0-1 on attractiveness as offshoring destinations:

| Factor | Weight | Source |
|---|---|---|
| Labor cost advantage | 30% | World Bank labor statistics |
| AI communication tool adoption | 25% | ITU ICT Development Index |
| English proficiency | 20% | EF English Proficiency Index |
| Tech infrastructure | 15% | ITU broadband penetration |
| Timezone overlap with US | 10% | Geographic |

Top destinations: India (0.92), Philippines (0.85), Poland (0.72), Vietnam (0.70), Mexico (0.68).

---

## Monte Carlo Engine

50,000 simulations per parameter set. All new dynamics feed into the engine:

- Trade policy modifies displacement rate (+15% for escalating tariffs, +5% for free trade)
- Corporate profit scenario modifies GDP growth (±0.5%)
- Equity loop break adds GDP drag (up to -0.8% at full feedback aggressiveness)
- Feedback aggressiveness amplifies displacement in medium/long term
- Government floor strength dampens cascade propagation

Outputs are always probability distributions with explicit confidence intervals.

---

## The Two Main Scenarios

**Bull case (Corporate profit surge)**: AI drives unprecedented productivity growth. Corporate profits surge 3-10x. Tax revenue rises enough to fund displaced workers through retraining and transfers. The transition is painful but manageable — similar to computerization in the 1980s-2000s but faster. Tech hubs thrive, manufacturing adapts through robotics, services sector restructures.

**Bear case (Deficit spiral with cascading feedback)**: Displacement outpaces new job creation. Government attempts to hold the floor through deficit spending. Deficits spiral. The AI equity narrative eventually breaks, removing the wealth effect that was propping up GDP. The K-shaped divergence becomes permanent. Government floor collapses around 2033 when deficits become politically unsustainable.

Both scenarios are plausible. The model shows both with honest uncertainty bands.

---

## Data Sources Summary

| Source | Data | Usage |
|---|---|---|
| O*NET 29.1 | Abilities, Work Activities, Work Context | AIOE, task pipeline, output verifiability |
| BLS OEWS May 2024 | MSA employment by occupation | County occupation employment |
| BLS QCEW 2023 | County employment by industry + ownership | MSA crosswalk, small business concentration, government employment |
| Census ACS 2022 | Income, Gini, transfer payments | K-shape, government floor, transfer dependency |
| NBER CBSA Crosswalk 2023 | MSA-to-county mapping | Geographic distribution |
| World Bank API | Employment by sector, labor force, population | International country scores |
| Frey & Osborne (2017) | Automation probabilities | Track 1 physical automation component |
| Felten, Raj, Seamans (2021) | AI capability × O*NET ability mapping | Track 1 core AIOE |
| IFR World Robotics | Robot density by industry | Track 2 calibration |
| Blinder-Krueger (2013) | Occupational tradability | Track 4 offshoring |
| Company displacement scraper | Documented corporate AI actions | Deployment evidence scores |

---

## What the Simulation Does and Doesn't Model

<!-- TODO: Draft full copy for this section. Key points to cover:
  - The Monte Carlo models displacement from ADOPTION of current AI capabilities
    (Eloundou GPT-4 task exposure scores, frozen at 2024 levels)
  - It does NOT model future capability improvements — if LLMs improve beyond
    GPT-4 levels, actual displacement will exceed the simulation's output
  - The S-curve represents deployment pace, not capability growth
  - The feedback cascade represents economic self-reinforcement (displacement
    causing more displacement via demand reduction), which is distinct from
    capability growth
  - Why we chose not to add a capability-growth parameter: avoids creating
    unfounded confidence in a speculative multiplier
  - Honest framing: "floor estimate under current capabilities" not "forecast"
-->

---

## Known Limitations

1. **Temporal mismatch**: Employment data (2024), O*NET (29.1), AI capability scores (2021). AI has advanced significantly since 2021 benchmarks.
2. **MSA-to-county crosswalk**: Assumes uniform occupation mix within MSAs. Understates local specialization.
3. **Rural county estimation**: ~2,000 non-MSA counties use industry-composition proxy. Less precise than occupation-level data.
4. **Agentic AI scores**: Forward-looking with no empirical validation yet. Treat as directional.
5. **Offshoring scores**: Based on theoretical tradability. Actual offshoring depends on corporate decisions, not just capability.
6. **Feedback loop calibration**: Self-reinforcing dynamics are difficult to parameterize from historical data because this transition is unprecedented in speed.
7. **Government response timing**: The model assumes government responds to thresholds, not proactively. Actual policy may lead or lag the model.
8. **K-shape wealth data**: Census income data is a proxy for equity ownership. Actual equity concentration is higher in some counties than income data suggests.
9. **Company displacement data**: Biased toward large, publicly traded, US-listed companies. Private companies and non-US companies are underrepresented.

---

## Reproducibility

- Random seed is fixed (42) for given parameter sets — same inputs produce same outputs
- All source data versions are pinned in `backend/data/scripts/config.py`
- AIOE computed from source data, not from an external pre-computed file
- Every simulation result includes the full list of assumptions and parameter values used
- Company displacement data curated with documented confidence scoring (1-5 scale)
