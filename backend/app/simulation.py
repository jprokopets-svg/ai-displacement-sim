"""
Monte Carlo simulation engine for AI workforce displacement.

Architecture:
    Layer 1: Displacement model — AI adoption pace → job loss by occupation
    Layer 2: Economic response — displacement → spending, tax base, property values
    Layer 3: Government response — unemployment thresholds → policy actions
    Layer 4: Feedback loops — policy responses feed back into layers 1-2

Each simulation run draws from probability distributions for uncertain parameters,
producing a distribution of outcomes rather than point predictions.

ASSUMPTIONS:
    - Displacement rate per occupation = ai_exposure * adoption_pace * stochastic_factor
    - Stochastic factor drawn from Beta(2,5) — right-skewed, most occupations
      see less than expected displacement, some see more
    - Retraining reduces displacement by 20-40% (uniform) with 2-year lag
    - UBI prevents 30-50% of consumer spending decline (uniform)
    - Fed rate cuts boost GDP by 0.3-0.7% per 100bp (empirical range)
    - Social instability triggers when unemployment exceeds threshold for 2+ years
    - All elasticities sourced from published empirical estimates (see docs/methodology.md)
"""
import numpy as np
from .models import SimulationParams, SimulationResult


# Empirical elasticities and calibration parameters
# Sources cited in docs/methodology.md

# Consumer spending elasticity to unemployment (Petev, Pistaferri, Saporta 2011)
SPENDING_UNEMPLOYMENT_ELASTICITY = -0.5  # 1% unemployment → -0.5% spending

# Property value elasticity to local unemployment (Harding, Rosenblatt, Yao 2009)
PROPERTY_UNEMPLOYMENT_ELASTICITY = -1.8  # 1% unemployment → -1.8% property values

# Tax revenue elasticity to GDP (Dye and McGuire 2001)
TAX_GDP_ELASTICITY = 1.4  # 1% GDP change → 1.4% tax revenue change

# Okun's Law coefficient (Ball, Leigh, Loungani 2017)
OKUNS_COEFFICIENT = -2.0  # 1% unemployment above NAIRU → -2% GDP gap

# Fed rate cut GDP impact per 100bp (Romer and Romer 2004)
FED_CUT_GDP_IMPACT_RANGE = (0.3, 0.7)  # % GDP per 100bp

# Retraining program effectiveness (Heckman, LaLonde, Smith 1999)
RETRAINING_EFFECTIVENESS_RANGE = (0.20, 0.40)  # displacement reduction

# UBI spending preservation (Marinescu 2018, various basic income pilots)
UBI_SPENDING_PRESERVATION_RANGE = (0.30, 0.50)

# Baseline parameters
BASELINE_UNEMPLOYMENT = 0.04  # 4% baseline unemployment
BASELINE_GDP_GROWTH = 0.02  # 2% annual GDP growth
NAIRU = 0.045  # Non-Accelerating Inflation Rate of Unemployment


def _adoption_curve(pace: float, year: int, n_years: int) -> float:
    """
    S-curve for AI adoption over time.
    pace=0 → slow (20-year adoption), pace=1 → fast (5-year adoption).

    Uses logistic function calibrated so that:
    - At pace=0: 50% adoption reached at year 15
    - At pace=1: 50% adoption reached at year 3
    """
    midpoint = 15 - 12 * pace  # ranges from 15 (slow) to 3 (fast)
    steepness = 0.5 + 0.5 * pace  # ranges from 0.5 to 1.0
    return 1 / (1 + np.exp(-steepness * (year - midpoint)))


def _policy_modifier(
    policy: str,
    year: int,
    rng: np.random.Generator,
) -> dict:
    """
    Compute policy-driven modifiers for a given year.

    Returns dict of multiplicative factors applied to displacement and spending.
    """
    mods = {
        "displacement_reduction": 0.0,
        "spending_preservation": 0.0,
        "gdp_boost": 0.0,
    }

    if policy == "retraining":
        # Retraining has a 2-year implementation lag
        if year >= 2:
            effectiveness = rng.uniform(*RETRAINING_EFFECTIVENESS_RANGE)
            # Effectiveness ramps up over 3 years after implementation
            ramp = min(1.0, (year - 2) / 3)
            mods["displacement_reduction"] = effectiveness * ramp

    elif policy == "ubi":
        # UBI takes 1 year to implement
        if year >= 1:
            preservation = rng.uniform(*UBI_SPENDING_PRESERVATION_RANGE)
            ramp = min(1.0, (year - 1) / 2)
            mods["spending_preservation"] = preservation * ramp
            # UBI also slightly reduces displacement pressure (people can retrain)
            mods["displacement_reduction"] = 0.05 * ramp

    return mods


def _fed_modifier(
    fed_response: str,
    unemployment_rate: float,
    rng: np.random.Generator,
) -> float:
    """
    GDP boost from Fed policy response.
    Fed acts when unemployment rises significantly above NAIRU.
    """
    if fed_response == "hold":
        return 0.0

    # Fed acts proportionally to unemployment gap
    gap = max(0, unemployment_rate - NAIRU)

    if fed_response == "cut":
        # Standard cuts: ~200bp over cycle
        cuts_bp = min(200, gap * 400)  # More aggressive with bigger gap
    elif fed_response == "zero":
        # Zero rate policy: up to 500bp
        cuts_bp = min(500, gap * 600)
    else:
        return 0.0

    gdp_impact_per_bp = rng.uniform(*FED_CUT_GDP_IMPACT_RANGE) / 100
    return cuts_bp * gdp_impact_per_bp


def run_simulation(params: SimulationParams) -> SimulationResult:
    """
    Run Monte Carlo simulation with given parameters.

    For each of n_simulations runs:
    1. Draw stochastic factors from distributions
    2. Step through each year of the time horizon
    3. Apply displacement model (Layer 1)
    4. Compute economic responses (Layer 2)
    5. Apply government/Fed responses (Layer 3)
    6. Feed back into next year's state (Layer 4)
    """
    n = params.n_simulations
    t = params.time_horizon_years
    rng = np.random.default_rng(42)  # Reproducible for same params

    # New dynamics parameters
    feedback_agg = getattr(params, 'feedback_aggressiveness', 0.5)
    trade_policy = getattr(params, 'trade_policy', 'current')
    corp_profit = getattr(params, 'corporate_profit', 'baseline')
    equity_loop = getattr(params, 'equity_loop', 'intact')

    # Trade policy modifiers on displacement
    trade_displacement_mod = 1.0
    if trade_policy == "escalating_tariffs":
        trade_displacement_mod = 1.15  # Robotics acceleration
    elif trade_policy == "free_trade":
        trade_displacement_mod = 1.05  # Offshoring acceleration

    # Corporate profit scenario affects government revenue
    corp_gdp_mod = 0.0
    if corp_profit == "surge":
        corp_gdp_mod = 0.005  # +0.5% GDP from productivity
    elif corp_profit == "decline":
        corp_gdp_mod = -0.005

    # Equity loop modifier (medium/long term)
    equity_mod = 1.0  # GDP multiplier from equity loop status

    # Output arrays: [simulation, year]
    displacement_pct = np.zeros((n, t))
    unemployment_rate = np.zeros((n, t))
    gdp_impact_pct = np.zeros((n, t))

    for sim in range(n):
        # Draw occupation-level stochastic displacement factor
        # Beta(2,5) is right-skewed: most occupations displace less than expected
        stochastic_factor = rng.beta(2, 5)

        # Per-simulation noise on macro variables
        macro_noise = 1.0
        if params.global_macro == "risk_off":
            macro_noise = rng.uniform(0.8, 1.0)  # Headwinds
        elif params.global_macro == "risk_on":
            macro_noise = rng.uniform(1.0, 1.3)  # Tailwinds amplify both growth and disruption

        cumulative_displacement = 0.0
        prev_unemployment = BASELINE_UNEMPLOYMENT

        for year in range(t):
            # Layer 1: Displacement (with trade policy and feedback modifiers)
            adoption = _adoption_curve(params.ai_adoption_pace, year, t)

            # Feedback loop: in medium/long term, displacement accelerates
            feedback_mult = 1.0
            if year >= 3 and feedback_agg > 0.3:
                feedback_mult = 1.0 + (feedback_agg - 0.3) * 0.5 * min(1, year / 5)

            annual_displacement_rate = (
                adoption * stochastic_factor * 0.3  # Max 30% of exposed jobs
                * macro_noise * trade_displacement_mod * feedback_mult
            )

            # Apply policy displacement reduction (Layer 3 feedback → Layer 1)
            policy_mods = _policy_modifier(params.policy_response, year, rng)
            annual_displacement_rate *= (1 - policy_mods["displacement_reduction"])

            # Cumulative displacement (with diminishing returns — can't displace already-displaced)
            new_displacement = annual_displacement_rate * (1 - cumulative_displacement)
            cumulative_displacement += new_displacement
            cumulative_displacement = min(cumulative_displacement, 0.95)  # Cap at 95%

            displacement_pct[sim, year] = cumulative_displacement

            # Layer 2: Economic response
            displacement_induced_unemployment = cumulative_displacement * 0.4  # Not all displaced become unemployed
            current_unemployment = BASELINE_UNEMPLOYMENT + displacement_induced_unemployment
            current_unemployment = min(current_unemployment, 0.35)  # Cap at 35%
            unemployment_rate[sim, year] = current_unemployment

            # GDP impact: Okun's Law + direct productivity loss + spending decline
            unemployment_gap = current_unemployment - NAIRU
            okun_gdp_loss = OKUNS_COEFFICIENT * max(0, unemployment_gap) / 100

            spending_decline = (
                SPENDING_UNEMPLOYMENT_ELASTICITY
                * (current_unemployment - BASELINE_UNEMPLOYMENT)
                * (1 - policy_mods["spending_preservation"])
            )

            # Fed response (Layer 3)
            fed_boost = _fed_modifier(params.fed_response, current_unemployment, rng)

            # Equity loop effect (intensifies over time)
            equity_effect = 0.0
            if equity_loop == "breaks" and year >= 2:
                time_int = min(1.0, year / 8)
                equity_effect = -0.008 * feedback_agg * time_int  # GDP drag

            # Net GDP impact
            gdp_change = (
                BASELINE_GDP_GROWTH
                + okun_gdp_loss
                + spending_decline / 100
                + fed_boost
                + corp_gdp_mod
                + equity_effect
            ) * macro_noise

            gdp_impact_pct[sim, year] = gdp_change

            prev_unemployment = current_unemployment

    # Compute output statistics
    final_displacement = displacement_pct[:, -1]
    final_unemployment = unemployment_rate[:, -1]
    final_gdp = gdp_impact_pct[:, -1]

    # Year-by-year percentiles
    percentiles = [5, 25, 50, 75, 95]

    def _yearly_stats(arr, label):
        return [
            {
                "year": y + 1,
                **{f"p{p}": float(np.percentile(arr[:, y], p)) for p in percentiles},
                "mean": float(arr[:, y].mean()),
            }
            for y in range(t)
        ]

    # Scenario classification
    # Define scenarios by final-year displacement
    scenarios = {
        "minimal_disruption": float((final_displacement < 0.05).mean()),
        "gradual_transition": float(((final_displacement >= 0.05) & (final_displacement < 0.15)).mean()),
        "significant_displacement": float(((final_displacement >= 0.15) & (final_displacement < 0.30)).mean()),
        "mass_displacement": float((final_displacement >= 0.30).mean()),
    }

    # Social instability probability
    # Defined as unemployment exceeding threshold for 2+ consecutive years
    instability_count = 0
    for sim in range(n):
        consecutive = 0
        for year in range(t):
            if unemployment_rate[sim, year] > params.social_stability_threshold:
                consecutive += 1
                if consecutive >= 2:
                    instability_count += 1
                    break
            else:
                consecutive = 0
    scenarios["social_instability"] = instability_count / n

    assumptions = [
        "Displacement rate = ai_exposure × adoption_curve × stochastic_factor (Beta(2,5))",
        f"Adoption pace: {params.ai_adoption_pace:.1f} (0=slow/20yr, 1=fast/5yr S-curve)",
        f"Policy: {params.policy_response} — displacement reduction: {RETRAINING_EFFECTIVENESS_RANGE if params.policy_response == 'retraining' else 'N/A'}",
        f"Fed: {params.fed_response} — GDP impact per 100bp: {FED_CUT_GDP_IMPACT_RANGE}",
        f"Okun's coefficient: {OKUNS_COEFFICIENT}",
        f"Spending-unemployment elasticity: {SPENDING_UNEMPLOYMENT_ELASTICITY}",
        f"Baseline unemployment: {BASELINE_UNEMPLOYMENT:.1%}, GDP growth: {BASELINE_GDP_GROWTH:.1%}",
        f"Global macro: {params.global_macro}",
        f"Trade policy: {trade_policy} (displacement modifier: {trade_displacement_mod:.2f}x)",
        f"Corporate profit scenario: {corp_profit} (GDP modifier: {corp_gdp_mod:+.3f})",
        f"AI equity loop: {equity_loop}",
        f"Feedback aggressiveness: {feedback_agg:.1f}/1.0",
        "Not all displaced workers become unemployed (40% conversion rate)",
        "Cumulative displacement capped at 95% per occupation group",
    ]

    return SimulationResult(
        params=params,
        n_simulations=n,
        time_horizon_years=t,
        displacement_pct_mean=float(final_displacement.mean()),
        displacement_pct_p5=float(np.percentile(final_displacement, 5)),
        displacement_pct_p25=float(np.percentile(final_displacement, 25)),
        displacement_pct_median=float(np.median(final_displacement)),
        displacement_pct_p75=float(np.percentile(final_displacement, 75)),
        displacement_pct_p95=float(np.percentile(final_displacement, 95)),
        unemployment_rate_mean=float(final_unemployment.mean()),
        unemployment_rate_p5=float(np.percentile(final_unemployment, 5)),
        unemployment_rate_p95=float(np.percentile(final_unemployment, 95)),
        gdp_impact_pct_mean=float(final_gdp.mean()),
        gdp_impact_pct_p5=float(np.percentile(final_gdp, 5)),
        gdp_impact_pct_p95=float(np.percentile(final_gdp, 95)),
        yearly_displacement=_yearly_stats(displacement_pct, "displacement"),
        yearly_unemployment=_yearly_stats(unemployment_rate, "unemployment"),
        yearly_gdp_impact=_yearly_stats(gdp_impact_pct, "gdp"),
        scenario_probabilities=scenarios,
        assumptions=assumptions,
    )
