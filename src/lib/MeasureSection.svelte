<script>
  import {
    getLatestYear,
    getBenchmarkValue,
    getTrendByType,
    getTrendRows
  } from '$lib/districtData.svelte.js';
  import { fmt1, fmtVal, buildLineChart, buildStripPlot } from '$lib/charts.svelte.js';

  let {
    title,
    intro = null,
    fingertipsIndicator = '',
    sexes = ['Female', 'Male'],
    hasHeadline = true,
    hasTrend = true,
    allowVariation = true,
    msoaIndicator = '',
    variationNote = '',
    unit = 'years',
    decimals = 1,
    higherIsBad = false,
    districtRows,
    msoaRows,
    selectedDistrict,
    selectedName
  } = $props();

  const usesFingertips = $derived(!!fingertipsIndicator && (hasHeadline || hasTrend));

  function isSingleYear(label) {
    return /^\s*\d{4}\s*$/.test(String(label));
  }
  // Obesity-style measures use academic years ("2024/25") and short pooled
  // ranges; those ARE the real series (not duplicate pooled rows like LE had),
  // so for non-single-year units we keep every period.
  function trendYearOk(label) {
    return unit === 'years' ? isSingleYear(label) : true;
  }

  // Local unit-aware value formatter (keeps LE on fmt1 for byte-identical output).
  function fv(v) {
    return unit === 'years' && decimals === 1 ? fmt1(v) : fmtVal(v, unit, decimals);
  }

  // ── Headline ─────────────────────────────────────────────────────────────
  function headline(sex) {
    const year = getLatestYear(districtRows, fingertipsIndicator, sex, '');
    const districtRow = districtRows.find(
      (r) =>
        r.indicator_label === fingertipsIndicator &&
        r.year === year &&
        r.area_code === selectedDistrict &&
        r.sex === sex
    );
    const hampshire = getBenchmarkValue(districtRows, fingertipsIndicator, year, 'county', sex, '');
    const england = getBenchmarkValue(districtRows, fingertipsIndicator, year, 'england', sex, '');
    return { sex, year, district: districtRow?.value ?? null, hampshire, england };
  }
  const heads = $derived(
    usesFingertips && hasHeadline && selectedDistrict ? sexes.map((s) => headline(s)) : []
  );
  const headBySex = $derived(Object.fromEntries(heads.map((h) => [h.sex, h])));
  const hasHeadlineData = $derived(heads.some((h) => h.district != null));

  // ── Trend ────────────────────────────────────────────────────────────────
  function trendDistrict(sex) {
    return getTrendRows(districtRows, fingertipsIndicator, selectedDistrict, sex, '')
      .filter((r) => r.value != null && trendYearOk(r.year));
  }
  function trendEngland(sex) {
    return getTrendByType(districtRows, fingertipsIndicator, 'england', sex, '')
      .filter((r) => trendYearOk(r.year));
  }
  const trends = $derived(
    usesFingertips && hasTrend && selectedDistrict
      ? sexes.map((s) => ({ sex: s, district: trendDistrict(s), england: trendEngland(s) }))
      : []
  );

  function trendSummary(series, label) {
    const pts = series.filter((p) => p.value != null);
    if (pts.length < 2) return '';
    const first = pts[0];
    const last = pts.at(-1);
    const diff = last.value - first.value;
    const near = unit === '%' ? 1.0 : 0.3;
    const dir = Math.abs(diff) < near ? 'changed little' : diff > 0 ? 'risen' : 'fallen';
    const subj = label === 'Persons' ? title.toLowerCase() : `${label} ${title.toLowerCase()}`;
    return `${subj.charAt(0).toUpperCase() + subj.slice(1)} has ${dir} from ${fv(first.value)} (${first.year}) to ${fv(last.value)} (${last.year}).`;
  }

  const SERIES_COLORS = {
    Female: { district: '#206095', england: '#902082', eLabel: 'Eng (F)' },
    Male: { district: '#0f8243', england: '#d07ac4', eLabel: 'Eng (M)' },
    Persons: { district: '#206095', england: '#902082', eLabel: 'England' }
  };

  const trendSVG = $derived.by(() => {
    if (!trends.length) return '';
    const anyPts = trends.some((t) => t.district.length || t.england.length);
    if (!anyPts) return '';
    const series = [];
    for (const t of trends) {
      const c = SERIES_COLORS[t.sex] ?? { district: '#206095', england: '#902082', eLabel: `Eng (${t.sex[0]})` };
      const districtLabel = t.sex === 'Persons' ? selectedName : t.sex;
      series.push({
        label: districtLabel, color: c.district, width: 2.5, bold: true,
        points: t.district.map((r) => ({ year: r.year, value: r.value }))
      });
      series.push({
        label: c.eLabel, color: c.england, width: 1.25, dash: '4,3',
        points: t.england.map((r) => ({ year: r.year, value: r.value }))
      });
    }
    return buildLineChart(series);
  });

  // ── Within-district variation (MSOA) ────────────────────────────────────
  const msoaVarRows = $derived(
    allowVariation && msoaIndicator
      ? msoaRows
          .filter(
            (r) =>
              r.indicator === msoaIndicator &&
              r.district === selectedName &&
              r.msoaCode &&
              !Number.isNaN(Number(r.value))
          )
          .map((r) => ({ name: r.msoaName, value: Number(r.value) }))
          .sort((a, b) => a.value - b.value)
      : []
  );

  const msoaStats = $derived.by(() => {
    if (!msoaVarRows.length) return null;
    const vals = msoaVarRows.map((r) => r.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return {
      min, max, avg,
      lowest: msoaVarRows[0],
      highest: msoaVarRows[msoaVarRows.length - 1],
      gap: max - min
    };
  });

  const stripSVG = $derived.by(() => buildStripPlot(msoaStats, msoaVarRows));

  const hasAnything = $derived(hasHeadlineData || !!trendSVG || !!msoaStats);
</script>

<section class="measure-section">
  <h2>{title}</h2>

  {#if hasAnything}
    {#if intro && hasHeadlineData}
      <p class="lede">{@html intro(selectedName, headBySex)}</p>
    {/if}

    {#if hasHeadline && hasHeadlineData}
      {#each sexes as sex}
        {@const h = headBySex[sex]}
        <div class="sex-block">
          {#if sex !== 'Persons'}<h3>{sex}</h3>{/if}
          <div class="stat-strip">
            <div class="stat-card">
              <div class="stat-card__label">{selectedName}</div>
              <div class="stat-card__value">{fv(h?.district)}</div>
              <div class="stat-card__note">{h?.year ?? ''}</div>
            </div>
            <div class="stat-card stat-card--green">
              <div class="stat-card__label">Hampshire</div>
              <div class="stat-card__value">{fv(h?.hampshire)}</div>
              <div class="stat-card__note">{h?.year ?? ''}</div>
            </div>
            <div class="stat-card stat-card--purple">
              <div class="stat-card__label">England</div>
              <div class="stat-card__value">{fv(h?.england)}</div>
              <div class="stat-card__note">{h?.year ?? ''}</div>
            </div>
          </div>
        </div>
      {/each}
    {/if}

    {#if trendSVG}
      <div class="trend">
        <h3>Change over time</h3>
        {@html trendSVG}
        <p class="trend-note">
          {#each trends as t}{trendSummary(t.district, t.sex)} {/each}
        </p>
      </div>
    {/if}

    {#if allowVariation && msoaStats}
      <div class="variation">
        <h3>Variation within {selectedName}</h3>
        <p class="lede">
          Across {selectedName}'s {msoaVarRows.length} MSOAs, {title.toLowerCase()}
          ranges from <strong>{fv(msoaStats.min)}</strong>
          in <strong>{msoaStats.lowest.name}</strong> up to
          <strong>{fv(msoaStats.max)}</strong> in
          <strong>{msoaStats.highest.name}</strong>, a gap of
          <strong>{fv(msoaStats.gap)}</strong> between the district's
          highest and lowest MSOAs.
        </p>
        {@html stripSVG}
        {#if variationNote}<p class="source">{variationNote}</p>{/if}
      </div>
    {/if}
  {:else}
    <p class="hint">No {title.toLowerCase()} data available for this district.</p>
  {/if}
</section>

<style>
  .measure-section { border-top: 4px solid #206095; padding-top: 1rem; margin-top: 2rem; }
  .measure-section h2 { color: #222; margin: 0 0 0.5rem; font-size: 24px; }
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

  .hint { color: #666; font-style: italic; }
  .source { font-size: 12px; color: #909090; margin-top: 10px; max-width: 62ch; line-height: 1.5; }
</style>