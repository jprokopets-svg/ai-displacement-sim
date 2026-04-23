
DECISION MEMO: FRS 2021 (v1) → Eloundou 2023 β (v2)
=====================================================

1. THREE BIGGEST DIFFERENCES:

   a) Score compression: v1 county scores range ~0.27–0.64 (37-point spread
      on the display scale). v2 compresses to ~26.26–41.69
      (15-point spread). The Eloundou β scores are a raw task-level
      exposure measure without the 7-component weighting (Frey-Osborne,
      deployment evidence, economic incentive, etc.) that spreads the v1
      distribution. Swapping β in as a drop-in replacement for the FRS
      component (20% weight) would be straightforward; replacing the entire
      composite would lose the other 6 signals.

   b) Occupation ordering flips: Eloundou β rates cognitive/analytical
      occupations HIGHER than v1 (Mathematicians: β=1.0, Computer Programmers:
      β=0.95). Physical/manual jobs properly go to 0. But some v1-high
      occupations like Data Entry (v1=100%) drop dramatically under Eloundou
      (β=89.3%) because Eloundou measures LLM exposure, not
      traditional automation exposure. The composite's Frey-Osborne and
      deployment-evidence components were covering that gap.

   c) Geographic patterns shift: DC-area counties remain in the top tier under v2 — the federal-contractor cognitive workforce pattern holds. But the precise rank ordering shifts (Spearman ρ = 0.958). Tech-heavy metros may rise under Eloundou.

2. DOES THE MR HEADLINE SURVIVE?

   Yes, with caveats. The DC suburbs still rank high under Eloundou because their workforce is heavily cognitive/analytical — exactly what Eloundou's LLM-exposure measure captures. The headline 'DC suburbs top the list' likely survives. But the specific scores and rank ordering within the top tier will change, and the narrative should acknowledge the methodological shift from general-AI to LLM-specific exposure.

3. WHAT WOULD BREAK VISUALLY?

   The color scale currently maps 0–64 on a continuous gradient. If v2 scores
   compress to a 15-point range, either the color mapping needs
   recalibration or the map will show less visual differentiation between
   counties. The existing 27–59 display range barely fills the gradient as-is.

4. V2 SURPRISES:

   - Eloundou β measures LLM task exposure, not general AI/automation exposure.
     This is a methodological change, not just a data update. Occupations
     exposed to robotics/RPA but not LLMs (truck drivers, cashiers, assemblers)
     would drop. This may be MORE correct for 2025 but loses the physical
     automation signal the composite currently captures.
   - School Psychologists (37.8% v1 → 39.2%) — the occupation from
     the MR/EBUG critique — would change under v2.
   - Airline Pilots (60.4% v1 → 35.2%) — the BAIOE comparison point.

5. REMAINING WORK TO SHIP:

   - If replacing only the FRS component (20% weight): ~4 hours. Drop-in the
     Eloundou β scores, rerun the composite pipeline, rebuild the DB.
   - If replacing the entire composite with Eloundou β: ~2-3 days. Need to
     recalibrate color scales, update methodology docs, re-validate all
     county rankings, update the Substack post, and QA the presentation.
   - Either way: need to decide whether to keep the 7-component composite
     (just swap component 1) or simplify to a single Eloundou-based score.
     The 7-component approach is more defensible but more complex. A pure
     Eloundou score is more citable but loses deployment evidence and
     economic incentive signals.
