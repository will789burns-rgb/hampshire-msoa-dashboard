<script>
  import { onMount } from 'svelte';
  import {
    getDistrictStore,
    loadDistrictData,
    getLatestYear,
    getBenchmarkValue,
    getTrendByType
  } from '$lib/districtData.svelte.js';
  import { getStore, loadData } from '$lib/data.svelte.js';

  const districtStore = getDistrictStore();
  const msoaStore = getStore();

  const DISTRICTS = [
    { code: 'E07000084', name: 'Basingstoke and Deane' },
    { code: 'E07000085', name: 'East Hampshire' },
    { code: 'E07000086', name: 'Eastleigh' },
    { code: 'E07000087', name: 'Fareham' },
    { code: 'E07000088', name: 'Gosport' },
    { code: 'E07000089', name: 'Hart' },
    { code: 'E07000090', name: 'Havant' },
    { code: 'E07000091', name: 'New Forest' },
    { code: 'E07000092', name: 'Rushmoor' },
    { code: 'E07000093', name: 'Test Valley' },
    { code: 'E07000094', name: 'Winchester' }
  ];

  let selectedDistrict = $state('');
  const selectedName = $derived(
    DISTRICTS.find((d) => d.code === selectedDistrict)?.name ?? ''
  );

  onMount(() => {
    loadDistrictData();
    loadData();
  });

  // ── Population overview (MSOA) ────────────────────────────────────────────
  const POP_INDICATOR = 'Total resident population (2023)';
  const popRows = $derived(
    msoaStore.rows.filter(
      (r) => r.indicator === POP_INDICATOR && r.msoaCode && !Number.isNaN(Number(r.value))
    )
  );
  const districtPopRows = $derived(popRows.filter((r) => r.district === selectedName));
  const districtPopulation = $derived(
    districtPopRows.reduce((sum, r) => sum + Number(r.value), 0)
  );
  const msoaCount = $derived(districtPopRows.length);
  const hampshirePopulation = $derived(popRows.reduce((sum, r) => sum + Number(r.value), 0));
  const popShare = $derived(
    hampshirePopulation ? (districtPopulation / hampshirePopulation) * 100 : 0
  );

  // ── Life expectancy headline + trend (Fingertips) ─────────────────────────
  const LE_INDICATOR = 'Life expectancy at birth';

  function leHeadline(sex) {
    const year = getLatestYear(districtStore.rows, LE_INDICATOR, sex, '');
    const districtRow = districtStore.rows.find(
      (r) =>
        r.indicator_label === LE_INDICATOR &&
        r.year === year &&
        r.area_code === selectedDistrict &&
        r.sex === sex
    );
    const hampshire = getBenchmarkValue(districtStore.rows, LE_INDICATOR, year, 'county', sex, '');
    const england = getBenchmarkValue(districtStore.rows, LE_INDICATOR, year, 'england', sex, '');
    return { year, district: districtRow?.value ?? null, hampshire, england };
  }
  const leMale = $derived(selectedDistrict ? leHeadline('Male') : null);
  const leFemale = $derived(selectedDistrict ? leHeadline('Female') : null);

  function leTrend(sex) {
    return districtStore.rows
      .filter(
        (r) =>
          r.indicator_label === LE_INDICATOR &&
          r.area_code === selectedDistrict &&
          r.sex === sex &&
          r.value != null
      )
      .sort((a, b) => yearKey(a.year) - yearKey(b.year));
  }
  function leTrendEngland(sex) {
    return getTrendByType(districtStore.rows, LE_INDICATOR, 'england', sex, '');
  }
  function yearKey(label) {
    const m = String(label).match(/\d{4}/);
    return m ? parseInt(m[0], 10) : 0;
  }

  const trendFemaleDistrict = $derived(selectedDistrict ? leTrend('Female') : []);
  const trendMaleDistrict = $derived(selectedDistrict ? leTrend('Male') : []);
  const trendFemaleEngland = $derived(selectedDistrict ? leTrendEngland('Female') : []);
  const trendMaleEngland = $derived(selectedDistrict ? leTrendEngland('Male') : []);

  function trendSummary(series, label) {
    const pts = series.filter((p) => p.value != null);
    if (pts.length < 2) return '';
    const first = pts[0];
    const last = pts.at(-1);
    const diff = last.value - first.value;
    const dir = Math.abs(diff) < 0.3 ? 'changed little' : diff > 0 ? 'risen' : 'fallen';
    return `${label} life expectancy has ${dir} from ${fmt1(first.value)} years (${first.year}) to ${fmt1(last.value)} years (${last.year}).`;
  }

  // ── Within-district variation (MSOA — single combined LE figure) ──────────
  const MSOA_LE_INDICATOR = 'Life expectancy at birth (2018 to 2022)';
  const msoaLeRows = $derived(
    msoaStore.rows
      .filter(
        (r) =>
          r.indicator === MSOA_LE_INDICATOR &&
          r.district === selectedName &&
          r.msoaCode &&
          !Number.isNaN(Number(r.value))
      )
      .map((r) => ({ name: r.msoaName, value: Number(r.value) }))
      .sort((a, b) => a.value - b.value)
  );

  const msoaLeStats = $derived.by(() => {
    if (!msoaLeRows.length) return null;
    const vals = msoaLeRows.map((r) => r.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return {
      min, max, avg,
      lowest: msoaLeRows[0],
      highest: msoaLeRows[msoaLeRows.length - 1],
      gap: max - min
    };
  });

  // ── Formatters ────────────────────────────────────────────────────────────
  function fmtInt(v) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
    return Number(v).toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }
  function fmt1(v) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
    return Number(v).toLocaleString('en-GB', { maximumFractionDigits: 1 });
  }
  function vsEngland(districtVal, englandVal) {
    if (districtVal == null || englandVal == null) return '';
    const diff = districtVal - englandVal;
    const absR = Math.abs(diff).toFixed(1);
    if (Math.abs(diff) < 0.3) return 'broadly in line with England';
    return diff > 0 ? `about ${absR} years above England` : `about ${absR} years below England`;
  }

  // ── Trend line chart (SVG) ────────────────────────────────────────────────
  function buildLineChart(series, width = 640, height = 280) {
    if (!series.length) return '';
    const pad = { top: 20, right: 130, bottom: 56, left: 56 };
    const W = width - pad.left - pad.right;
    const H = height - pad.top - pad.bottom;
    const allYears = [...new Set(series.flatMap((s) => s.points.map((p) => p.year)))]
      .sort((a, b) => yearKey(a) - yearKey(b));
    const allVals = series.flatMap((s) => s.points.map((p) => p.value)).filter((v) => v != null);
    if (!allVals.length || allYears.length < 2) return '';
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const rangeV = maxV - minV || 1;
    const xScale = (y) => (allYears.indexOf(y) / Math.max(allYears.length - 1, 1)) * W;
    const yScale = (v) => H - ((v - minV) / rangeV) * H;
    const ticks = 5;
    const yTicks = Array.from({ length: ticks }, (_, i) => minV + (rangeV / (ticks - 1)) * i);
    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:'Open Sans',Arial,sans-serif">`;
    svg += `<g transform="translate(${pad.left},${pad.top})">`;
    for (const t of yTicks) {
      const y = yScale(t);
      svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#e8e8e8" stroke-width="1"/>`;
      svg += `<text x="-8" y="${y + 4}" text-anchor="end" font-size="11" fill="#707070">${fmt1(t)}</text>`;
    }
    // X-axis labels: show ~5 evenly spaced, kept horizontal.
    const maxLabels = 5;
    const stepEvery = Math.max(1, Math.ceil(allYears.length / maxLabels));
    allYears.forEach((yr, i) => {
      if (i % stepEvery === 0 || i === allYears.length - 1) {
        svg += `<text x="${xScale(yr)}" y="${H + 18}" text-anchor="middle" font-size="10" fill="#707070">${yr}</text>`;
      }
    });
    const labels = [];
    for (const s of series) {
      const pts = s.points.filter((p) => p.value != null);
      if (pts.length < 2) continue;
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.year)},${yScale(p.value)}`).join(' ');
      svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width ?? 2}" stroke-dasharray="${s.dash ?? ''}" stroke-linejoin="round" stroke-linecap="round"/>`;
      const last = pts.at(-1);
      svg += `<circle cx="${xScale(last.year)}" cy="${yScale(last.value)}" r="4" fill="${s.color}"/>`;
      labels.push({ y: yScale(last.value), color: s.color, bold: s.bold, label: s.label });
    }
    labels.sort((a, b) => a.y - b.y);
    const minGap = 14;
    for (let i = 1; i < labels.length; i++) {
      if (labels[i].y - labels[i - 1].y < minGap) labels[i].y = labels[i - 1].y + minGap;
    }
    for (const lab of labels) {
      lab.y = Math.max(8, Math.min(H, lab.y));
      svg += `<text x="${W + 8}" y="${lab.y + 4}" font-size="11" fill="${lab.color}" font-weight="${lab.bold ? '700' : '400'}">${lab.label}</text>`;
    }
    svg += `</g></svg>`;
    return svg;
  }

  const leTrendSVG = $derived.by(() => {
    if (!trendFemaleDistrict.length && !trendMaleDistrict.length) return '';
    return buildLineChart([
      { label: 'Female', color: '#206095', width: 2.5, bold: true,
        points: trendFemaleDistrict.map((r) => ({ year: r.year, value: r.value })) },
      { label: 'Male', color: '#0f8243', width: 2.5, bold: true,
        points: trendMaleDistrict.map((r) => ({ year: r.year, value: r.value })) },
      { label: 'Eng (F)', color: '#902082', width: 1.25, dash: '4,3',
        points: trendFemaleEngland.map((r) => ({ year: r.year, value: r.value })) },
      { label: 'Eng (M)', color: '#d07ac4', width: 1.25, dash: '4,3',
        points: trendMaleEngland.map((r) => ({ year: r.year, value: r.value })) }
    ]);
  });

  // ── MSOA variation strip plot (SVG) ───────────────────────────────────────
  const stripSVG = $derived.by(() => {
    const s = msoaLeStats;
    if (!s || !msoaLeRows.length) return '';
    const width = 640, height = 110;
    const pad = { left: 20, right: 20, top: 28, bottom: 34 };
    const W = width - pad.left - pad.right;
    const axisY = 50;
    const lo = Math.floor(s.min - 1);
    const hi = Math.ceil(s.max + 1);
    const x = (v) => ((v - lo) / (hi - lo)) * W;
    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:'Open Sans',Arial,sans-serif">`;
    svg += `<g transform="translate(${pad.left},0)">`;
    svg += `<line x1="0" y1="${axisY}" x2="${W}" y2="${axisY}" stroke="#ccc" stroke-width="1"/>`;
    [lo, Math.round((lo + hi) / 2), hi].forEach((t) => {
      svg += `<line x1="${x(t)}" y1="${axisY - 4}" x2="${x(t)}" y2="${axisY + 4}" stroke="#999"/>`;
      svg += `<text x="${x(t)}" y="${axisY + 20}" text-anchor="middle" font-size="11" fill="#707070">${t}</text>`;
    });
    svg += `<line x1="${x(s.avg)}" y1="${axisY - 18}" x2="${x(s.avg)}" y2="${axisY + 6}" stroke="#902082" stroke-width="2"/>`;
    svg += `<text x="${x(s.avg)}" y="${axisY - 22}" text-anchor="middle" font-size="10" fill="#902082" font-weight="700">District average ${fmt1(s.avg)}</text>`;
    for (const r of msoaLeRows) {
      svg += `<circle cx="${x(r.value)}" cy="${axisY}" r="5" fill="#206095" fill-opacity="0.5" stroke="#206095" stroke-width="1"><title>${r.name}: ${fmt1(r.value)} years</title></circle>`;
    }
    svg += `</g></svg>`;
    return svg;
  });
</script>

<svelte:head>
  <title>Area Report — Hampshire JSNA</title>
</svelte:head>

<main class="report">
  <a href="/" class="back-link">← Back to all tools</a>

  <h1>Area Report</h1>
  <p class="intro">
    Choose a district to see a narrative profile comparing it to England and
    Hampshire, with a look at how MSOAs vary within it.
  </p>

  <label class="picker">
    <span class="picker__label">Select a district</span>
    <select bind:value={selectedDistrict}>
      <option value="" disabled>Choose a district…</option>
      {#each DISTRICTS as d}
        <option value={d.code}>{d.name}</option>
      {/each}
    </select>
  </label>

  {#if !selectedName}
    <p class="hint">Pick a district above to begin.</p>
  {:else if msoaStore.loading || districtStore.loading}
    <p class="hint">Loading area data…</p>
  {:else}
    <!-- OVERVIEW -->
    <section class="overview">
      <h2>{selectedName}</h2>
      <p class="lede">
        {selectedName} is home to around <strong>{fmtInt(districtPopulation)}</strong>
        residents across <strong>{msoaCount}</strong> MSOAs. That's
        about <strong>{popShare.toFixed(1)}%</strong> of Hampshire's population.
      </p>
      <div class="stat-strip">
        <div class="stat-card">
          <div class="stat-card__label">Total population</div>
          <div class="stat-card__value">{fmtInt(districtPopulation)}</div>
          <div class="stat-card__note">Sum of MSOA estimates (2023)</div>
        </div>
        <div class="stat-card stat-card--green">
          <div class="stat-card__label">MSOAs</div>
          <div class="stat-card__value">{msoaCount}</div>
          <div class="stat-card__note">Within {selectedName}</div>
        </div>
        <div class="stat-card stat-card--purple">
          <div class="stat-card__label">Share of Hampshire</div>
          <div class="stat-card__value">{popShare.toFixed(1)}%</div>
          <div class="stat-card__note">Of county population</div>
        </div>
      </div>
    </section>

    <!-- LIFE EXPECTANCY -->
    <section class="measure-section">
      <h2>Life expectancy at birth</h2>

      {#if leMale?.district != null || leFemale?.district != null}
        <p class="lede">
          In {selectedName}, life expectancy at birth is
          <strong>{fmt1(leFemale?.district)}</strong> years for females and
          <strong>{fmt1(leMale?.district)}</strong> years for males{#if leFemale?.district != null && leFemale?.england != null}. Females are {vsEngland(leFemale.district, leFemale.england)}{/if}.
        </p>

        <div class="sex-block">
          <h3>Female</h3>
          <div class="stat-strip">
            <div class="stat-card">
              <div class="stat-card__label">{selectedName}</div>
              <div class="stat-card__value">{fmt1(leFemale?.district)}</div>
              <div class="stat-card__note">{leFemale?.year ?? ''}</div>
            </div>
            <div class="stat-card stat-card--green">
              <div class="stat-card__label">Hampshire</div>
              <div class="stat-card__value">{fmt1(leFemale?.hampshire)}</div>
              <div class="stat-card__note">{leFemale?.year ?? ''}</div>
            </div>
            <div class="stat-card stat-card--purple">
              <div class="stat-card__label">England</div>
              <div class="stat-card__value">{fmt1(leFemale?.england)}</div>
              <div class="stat-card__note">{leFemale?.year ?? ''}</div>
            </div>
          </div>
        </div>

        <div class="sex-block">
          <h3>Male</h3>
          <div class="stat-strip">
            <div class="stat-card">
              <div class="stat-card__label">{selectedName}</div>
              <div class="stat-card__value">{fmt1(leMale?.district)}</div>
              <div class="stat-card__note">{leMale?.year ?? ''}</div>
            </div>
            <div class="stat-card stat-card--green">
              <div class="stat-card__label">Hampshire</div>
              <div class="stat-card__value">{fmt1(leMale?.hampshire)}</div>
              <div class="stat-card__note">{leMale?.year ?? ''}</div>
            </div>
            <div class="stat-card stat-card--purple">
              <div class="stat-card__label">England</div>
              <div class="stat-card__value">{fmt1(leMale?.england)}</div>
              <div class="stat-card__note">{leMale?.year ?? ''}</div>
            </div>
          </div>
        </div>

        <!-- TREND -->
        {#if leTrendSVG}
          <div class="trend">
            <h3>Change over time</h3>
            {@html leTrendSVG}
            <p class="trend-note">
              {trendSummary(trendFemaleDistrict, 'Female')}
              {trendSummary(trendMaleDistrict, 'Male')}
            </p>
          </div>
        {/if}

        <!-- WITHIN-DISTRICT VARIATION -->
        {#if msoaLeStats}
          <div class="variation">
            <h3>Variation within {selectedName}</h3>
            <p class="lede">
              Across {selectedName}'s {msoaLeRows.length} MSOAs, life expectancy
              (all residents combined) ranges from <strong>{fmt1(msoaLeStats.min)}</strong>
              years in <strong>{msoaLeStats.lowest.name}</strong> up to
              <strong>{fmt1(msoaLeStats.max)}</strong> years in
              <strong>{msoaLeStats.highest.name}</strong>, a gap of
              <strong>{fmt1(msoaLeStats.gap)}</strong> years between the district's
              healthiest and least healthy MSOAs.
            </p>
            {@html stripSVG}
            <p class="source">
              Each dot is one neighbourhood (MSOA). This is a combined male and female
              figure, so it is not directly comparable to the sex-specific values above.
              Source: Hampshire Public Health Intelligence Team (2018 to 2022).
            </p>
          </div>
        {/if}
      {:else}
        <p class="hint">No life expectancy data available for this district.</p>
      {/if}
    </section>
  {/if}
</main>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap');

  .report {
    max-width: 960px; margin: 0 auto; padding: 2rem 1rem 4rem;
    font-family: 'Open Sans', system-ui, sans-serif; color: #222;
  }
  h1 { color: #206095; font-weight: 700; }
  .intro { font-size: 1.05rem; line-height: 1.5; max-width: 60ch; }

  .back-link {
    display: inline-block; margin-bottom: 1rem; font-size: 14px;
    font-weight: 600; color: #206095; text-decoration: none;
  }
  .back-link:hover { text-decoration: underline; }
  .back-link:focus-visible { outline: 3px solid #fbc900; outline-offset: 2px; }

  .picker { display: flex; flex-direction: column; gap: 6px; margin: 1.5rem 0; max-width: 360px; }
  .picker__label { font-weight: 600; font-size: 14px; }
  select { font: inherit; font-size: 15px; padding: 9px 10px; border: 2px solid #222; border-radius: 0; background: #fff; }
  select:focus { outline: 3px solid #fbc900; box-shadow: inset 0 0 0 1px #222; }

  .overview, .measure-section { border-top: 4px solid #206095; padding-top: 1rem; margin-top: 2rem; }
  .overview h2, .measure-section h2 { color: #222; margin: 0 0 0.5rem; font-size: 24px; }
  .lede { font-size: 1.05rem; line-height: 1.55; max-width: 62ch; }

  .sex-block { margin: 1.25rem 0; }
  .sex-block h3, .trend h3, .variation h3 { font-size: 16px; color: #444; margin: 1.25rem 0 0.5rem; }

  .stat-strip { display: flex; gap: 1px; background: #d9d9d9; border: 1px solid #d9d9d9; margin: 0.5rem 0 1rem; }
  .stat-card { flex: 1; background: #fff; padding: 14px 18px; border-top: 4px solid #206095; }
  .stat-card--green { border-top-color: #0f8243; }
  .stat-card--purple { border-top-color: #902082; }
  .stat-card__label { font-size: 13px; color: #555; margin-bottom: 4px; }
  .stat-card__value { font-size: 28px; font-weight: 700; color: #222; line-height: 1; }
  .stat-card__note { font-size: 12px; color: #909090; margin-top: 4px; }

  .trend, .variation { margin-top: 1.5rem; }
  .trend-note { font-size: 14px; color: #444; line-height: 1.5; margin-top: 0.5rem; max-width: 62ch; }

  .placeholder, .hint { color: #666; font-style: italic; }
  .source { font-size: 12px; color: #909090; margin-top: 10px; max-width: 62ch; line-height: 1.5; }

  @media (max-width: 700px) { .stat-strip { flex-direction: column; } }
</style>