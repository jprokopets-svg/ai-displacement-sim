/**
 * Static methodology page — renders the v2 methodology document.
 * Content is pre-converted from markdown to JSX (no runtime markdown dep).
 */

export default function MethodologyPage() {
  return (
    <div style={wrapStyle}>
      <article style={articleStyle}>
        <h1 style={h1Style}>Methodology</h1>

        <p style={pStyle}>
          This page explains how yourjobrisk.com computes county-level AI exposure and what the simulation does and doesn't claim.
          It is written for readers who want to understand the model well enough to argue with it.
          For the narrative version of why I built this and what the findings looked like at v1, see{' '}
          <a href="https://jakeprokopets.substack.com/p/why-the-most-ai-exposed-counties" target="_blank" rel="noopener" style={linkStyle}>
            the original Substack post
          </a>.
        </p>

        <p style={pStyle}>
          The short version: v2 replaces the exposure measure used in v1, removes presentation features the new measure cannot defensibly support,
          and adds a layer of statistical regularization that the v1 pipeline was missing. The result is a tool that says less than v1 said, but says it more honestly.
        </p>

        <h2 style={h2Style}>What changed from v1</h2>

        <p style={pStyle}>
          v1 used the Felten, Raj, and Seamans (2021) AI Occupational Exposure scores as its measure of cognitive AI capability.
          FRS is a reasonable measure for general AI exposure circa 2020, but its underlying capability data predates the LLM era.
          Using it to score a labor market shaped by GPT-4 and its successors meant scoring 2024 jobs against 2018 capabilities.
        </p>

        <p style={pStyle}>
          v2 replaces FRS with{' '}
          <a href="https://arxiv.org/abs/2303.10130" target="_blank" rel="noopener" style={linkStyle}>Eloundou et al. 2024</a>,
          which directly measures task-level exposure to GPT-4. The Eloundou methodology asks, for each task in O*NET,
          whether GPT-4 (or GPT-4 plus tools) can reduce the time required to complete it by at least 50 percent without reducing quality.
          The resulting score, &beta;, is the share of an occupation's tasks that meet that bar. It is the closest thing the literature has
          to a direct measure of what current language models can do at work.
        </p>

        <p style={pStyle}>
          v1 also presented exposure across four "tracks": cognitive AI, industrial robotics, agentic AI, and offshoring.
          Each track was a multiplier applied to the FRS score (cognitive &times; 1.1, robotics &times; 0.6, agentic &times; 0.9, offshoring &times; 0.7).
          The tracks gave the appearance of measuring four different mechanisms, but all four numbers came from the same underlying score.
          With FRS, this was intellectually weak but defensible — FRS was at least a general-AI measure.
          With Eloundou, which is explicitly LLM-specific, multiplying it by 0.6 to produce an "industrial robotics exposure score" is not a measurement.
          It is a guess wearing a number.
        </p>

        <p style={pStyle}>
          v2 drops the multi-track presentation. There is one exposure score per county.
          The methodology page you are reading is the place to discuss what that score covers and what it doesn't.
        </p>

        <h2 style={h2Style}>How county scores are built</h2>

        <p style={pStyle}>The pipeline runs in three stages.</p>

        <p style={pStyle}>
          <strong>Stage 1: occupation-level exposure.</strong> For each of 798 occupations at the 6-digit SOC level,
          the model uses the Eloundou GPT-4 &beta; score directly. A software developer's &beta; is 0.868. An accountant's is 0.560.
          An electrician's is 0.146. These are not derived; they are the published Eloundou scores, which I treat as authoritative
          for the LLM-specific exposure question.
        </p>

        <p style={pStyle}>
          <strong>Stage 2: county aggregation.</strong> For counties inside Metropolitan Statistical Areas, BLS OEWS 2024 reports
          occupational employment at the MSA level. The model assigns each county its MSA's occupation mix scaled to the county's
          share of total private employment from QCEW. The county's exposure score is the employment-weighted mean of Eloundou &beta;
          across all occupations: &Sigma;(employment &times; &beta;) / &Sigma;(employment).
        </p>

        <p style={pStyle}>
          For counties not in any MSA — about 1,960 of 3,204 — OEWS does not provide occupation-level data. The model substitutes
          a sector-level estimate: county employment by 2-digit NAICS sector from QCEW, weighted by sector-level Eloundou exposure
          scores derived from national OEWS industry data. This is a coarser estimate, and the methodology marks these counties
          as estimated in the API response.
        </p>

        <p style={pStyle}>
          <strong>Stage 3: shrinkage.</strong> Counties with small employment bases produce noisy direct estimates.
          A microcounty whose entire professional services sector is two law firms and a consulting LLC will swing wildly based on
          accidents of NAICS classification. To handle this, the model applies Fay-Herriot empirical Bayes shrinkage, the standard
          small-area estimation technique used by the Census Bureau's{' '}
          <a href="https://www.census.gov/programs-surveys/saipe.html" target="_blank" rel="noopener" style={linkStyle}>SAIPE program</a>{' '}
          for county poverty estimates since the late 1990s.
        </p>

        <p style={pStyle}>
          The mechanic is straightforward. Each county's final score is a weighted blend of its raw direct estimate and its
          state's anchor — the employment-weighted mean of Eloundou exposure across that state's MSA-based counties.
          The blend weight depends on county employment size: large counties retain almost their entire direct estimate, small counties
          are pulled most of the way to the state anchor. The weighting is <em>w = N / (N + k)</em>, where <em>N</em> is county
          employment and <em>k</em> is the median county employment across the United States. A county at the median of US county
          sizes gets a 50/50 blend. A county ten times the median size gets 91 percent direct estimate. A county a tenth the median
          size gets 9 percent.
        </p>

        <p style={pStyle}>
          This matters more than it sounds. Without shrinkage, the OEWS-MSA crosswalk produces severe score degeneracy: of 1,244
          MSA-based counties, only 314 had unique scores in the unshrunk pipeline because every county within an MSA was assigned
          the same occupation mix. Twenty-three counties in the Washington DC metro all scored 0.393. With shrinkage, that number
          rises to 579 unique values, because counties of different sizes within the same MSA get pulled toward state anchors at
          different rates. The map gains real county-level variation that the underlying employment data, taken alone, could not provide.
        </p>

        <h2 style={h2Style}>Bucket presentation</h2>

        <p style={pStyle}>
          v2's default presentation groups counties into four exposure quartiles — Lower, Lower-mid, Upper-mid, Higher — rather
          than the continuous gradient v1 used. There is a toggle for users who prefer continuous mode.
        </p>

        <p style={pStyle}>
          The reason is in the data. After aggregation and shrinkage, US county-level Eloundou exposure scores cluster tightly:
          about 89 percent of counties fall within a single five-point band around the national mean of 0.33. The signal lives in
          the tails. The bottom quartile, mostly agricultural and manufacturing-heavy economies, spans about six points of score.
          The top quartile, dominated by tech hubs and the DC metro, spans about seven. The middle two quartiles each span less than one point.
        </p>

        <p style={pStyle}>
          A continuous gradient on this distribution implies precision the data does not have. Two counties with scores of 0.329
          and 0.335 are not meaningfully different from one another in any defensible sense; they are both in the broad American
          middle where occupation mixes resemble the national average. The four-bucket presentation tells the truth about what the
          data can resolve: there is a low-exposure tail, a high-exposure tail, and a large middle band where the model declines
          to claim it can rank counties against each other.
        </p>

        <p style={pStyle}>
          This is a deliberate retreat from v1's visual confidence. v1 displayed paralegals at 75.7 percent exposure. The decimal
          place was false precision. v2 rounds all scores to whole numbers everywhere. We depend on our least accurate inputs for
          our levels of uncertainty, and the inputs do not support a tenth of a percentage point.
        </p>

        <h2 style={h2Style}>What the Monte Carlo does and does not model</h2>

        <p style={pStyle}>
          The simulation runs 50,000 paths against varying assumptions about adoption pace, government policy response, feedback
          dynamics, and macroeconomic shocks. It produces a distribution of displacement outcomes through 2040. Default assumptions
          yield a median displacement of about 33 percent of the at-risk workforce by 2035 and about 35 percent by 2040.
        </p>

        <p style={pStyle}>
          These numbers are lower than v1's defaults (47 percent median, 62 percent at the 90th percentile), and the reason matters.
          v2 models displacement from the <em>adoption</em> of current AI capabilities. It does not model future capability improvements.
          The Eloundou scores measure what GPT-4-class systems can do; the simulation propagates that through varying deployment
          scenarios. If you believe LLM capabilities will meaningfully exceed GPT-4 over the next 15 years — which is the consensus
          expectation, including at the labs building the systems — actual displacement will exceed the simulation's output.
        </p>

        <p style={pStyle}>
          I considered adding a capability growth parameter. I declined for the same reason v2 dropped the multi-track presentation:
          there is no defensible empirical grounding for projecting how fast LLM capabilities will improve. Eloundou measured GPT-4.
          There is no published equivalent for GPT-5 or for whatever comes after it. Any number I picked would be a guess, and adding
          a guess to a model that's specifically trying to remove guesses would defeat the point. The honest version is to make the
          assumption explicit: this simulation is a lower bound under the assumption that AI capabilities stop improving today.
          The methodology page is more useful than a fake number.
        </p>

        <p style={pStyle}>
          The simulation also includes a "years to threshold" metric, defaulting to 12 percent displacement. The threshold is
          user-adjustable. The 12 percent default is not empirically grounded; it is a midpoint between recession-era unemployment
          peaks and pandemic-era ones, and users who want to ask different questions can move it.
        </p>

        <h2 style={h2Style}>Sources</h2>

        <ul style={ulStyle}>
          <li style={liStyle}>Eloundou, T., Manning, S., Mishkin, P., & Rock, D. (2024). <em>GPTs are GPTs: Labor market impact potential of LLMs</em>. arXiv:2303.10130.</li>
          <li style={liStyle}>Felten, E. W., Raj, M., & Seamans, R. (2021). <em>Occupational, industry, and geographic exposure to artificial intelligence: A novel dataset and its potential uses</em>. Strategic Management Journal, 42(12), 2195–2217.</li>
          <li style={liStyle}>Brynjolfsson, E., Chandar, B., & Chen, R. (2025). <em>Canaries in the coal mine? Six facts about the recent employment effects of artificial intelligence</em>. Stanford Digital Economy Lab.</li>
          <li style={liStyle}>U.S. Bureau of Labor Statistics. (2024). <em>Occupational Employment and Wage Statistics, May 2024</em>. bls.gov/oes.</li>
          <li style={liStyle}>Fay, R. E., & Herriot, R. A. (1979). <em>Estimates of income for small places: An application of James-Stein procedures to census data</em>. Journal of the American Statistical Association, 74(366), 269–277.</li>
          <li style={liStyle}>U.S. Census Bureau. <em>Small Area Income and Poverty Estimates Program (SAIPE)</em>: methodology. census.gov/programs-surveys/saipe.</li>
        </ul>

        <h2 style={h2Style}>Limitations</h2>

        <p style={pStyle}>
          The MSA-to-county crosswalk is the largest remaining methodological weakness. OEWS does not publish occupation-level
          employment at sub-MSA resolution, which means that even after shrinkage, two counties in the same metropolitan area
          share most of their occupation mix by construction. A future version of this tool will use spatial econometric methods
          and finer industry classifications to push resolution below the MSA. v2 does not.
        </p>

        <p style={pStyle}>
          The tool measures task-level exposure, not displacement. A high-exposure occupation is one where current language models
          can do a meaningful share of the work. Whether they will be deployed to do it depends on adoption costs, regulatory
          friction, organizational inertia, and a hundred other factors the model represents only as user-adjustable parameters.
          Exposure is the upper bound; deployment is what actually happens.
        </p>

        <p style={pStyle}>
          The simulation propagates current capability forward; it does not model AI capability growth. See above.
        </p>

        <p style={pStyle}>
          If you find a specific issue with the methodology,{' '}
          <a href="mailto:jprokopets@gmail.com" style={linkStyle}>my email is here</a>. I want the critiques.
        </p>

        <div style={footerStyle}>
          <a href="/tool" style={linkStyle}>Back to the tool</a>
        </div>
      </article>
    </div>
  )
}

const wrapStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg-primary)',
  display: 'flex',
  justifyContent: 'center',
  padding: '40px 20px 80px',
  boxSizing: 'border-box',
}

const articleStyle: React.CSSProperties = {
  maxWidth: 720,
  width: '100%',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
  lineHeight: 1.7,
}

const h1Style: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  marginBottom: 24,
  color: 'var(--text-primary)',
}

const h2Style: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  marginTop: 40,
  marginBottom: 12,
  color: 'var(--text-primary)',
  paddingBottom: 6,
  borderBottom: '1px solid var(--border)',
}

const pStyle: React.CSSProperties = {
  fontSize: 15,
  color: 'var(--text-secondary)',
  marginBottom: 16,
}

const linkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'none',
}

const ulStyle: React.CSSProperties = {
  paddingLeft: 20,
  marginBottom: 16,
}

const liStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-secondary)',
  marginBottom: 10,
  lineHeight: 1.6,
}

const footerStyle: React.CSSProperties = {
  marginTop: 48,
  paddingTop: 20,
  borderTop: '1px solid var(--border)',
  fontSize: 14,
}
