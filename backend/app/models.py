"""Pydantic models for API request/response schemas."""
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class CountyScore(BaseModel):
    county_fips: str
    county_name: str
    ai_exposure_score: float
    total_employment: float
    exposed_employment: float
    mean_wage_weighted: float
    exposure_percentile: float
    n_occupations: int


class OccupationExposure(BaseModel):
    soc_code: str
    occupation_title: str
    ai_exposure: float


class CountyOccupation(BaseModel):
    soc_code: str
    occupation_title: str
    employment: float
    ai_exposure: float
    mean_wage: Optional[float]


class CountyDetail(BaseModel):
    county: CountyScore
    top_exposed_occupations: List[CountyOccupation]
    top_employment_occupations: List[CountyOccupation]


class OccupationDetail(BaseModel):
    occupation: OccupationExposure
    top_counties: List[dict]


# Monte Carlo simulation models

class SimulationParams(BaseModel):
    """Input parameters for the Monte Carlo simulation."""
    ai_adoption_pace: float = Field(
        default=0.5, ge=0.0, le=1.0,
        description="0=slow, 1=fast. Controls annual displacement rate."
    )
    policy_response: str = Field(
        default="none",
        description="Government policy: 'none', 'retraining', 'ubi'"
    )
    fed_response: str = Field(
        default="hold",
        description="Fed policy: 'hold', 'cut', 'zero'"
    )
    social_stability_threshold: float = Field(
        default=0.10, ge=0.01, le=0.30,
        description="Unemployment rate that triggers social instability"
    )
    global_macro: str = Field(
        default="neutral",
        description="Global conditions: 'risk_on', 'neutral', 'risk_off'"
    )
    n_simulations: int = Field(
        default=50000, ge=100, le=100000,
        description="Number of Monte Carlo runs"
    )
    time_horizon_years: int = Field(
        default=10, ge=1, le=30,
        description="Simulation time horizon in years"
    )
    county_fips: Optional[str] = Field(
        default=None,
        description="Optional: focus simulation on a specific county"
    )


class SimulationResult(BaseModel):
    """Output of a Monte Carlo simulation run."""
    params: SimulationParams
    n_simulations: int
    time_horizon_years: int

    # Aggregate displacement outcomes (across all simulations)
    displacement_pct_mean: float
    displacement_pct_p5: float
    displacement_pct_p25: float
    displacement_pct_median: float
    displacement_pct_p75: float
    displacement_pct_p95: float

    # Unemployment rate outcomes
    unemployment_rate_mean: float
    unemployment_rate_p5: float
    unemployment_rate_p95: float

    # GDP impact
    gdp_impact_pct_mean: float
    gdp_impact_pct_p5: float
    gdp_impact_pct_p95: float

    # Year-by-year trajectories (percentiles)
    yearly_displacement: List[dict]
    yearly_unemployment: List[dict]
    yearly_gdp_impact: List[dict]

    # Scenario probabilities
    scenario_probabilities: Dict[str, float]

    # Assumptions used
    assumptions: List[str]
