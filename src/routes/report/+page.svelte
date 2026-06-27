<script>
  import { onMount, tick } from 'svelte';
  import {
    getDistrictStore,
    loadDistrictData,
    getLatestYear,
    getBenchmarkValue,
    getTrendByType
  } from '$lib/districtData.svelte.js';
  import { getStore, loadData } from '$lib/data.svelte.js';
  import { fmtInt, fmt1, vsEngland, yearKey, buildLineChart, buildStripPlot } from '$lib/charts.svelte.js';

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

  // Leaflet + geojson
  let L;
  let districtGeo = $state(null);
  let locatorEl;   // left map container
  let msoaMapEl;   // right map container
  let locatorMap;
  let msoaMap;

  onMount(async () => {
    loadDistrictData();
    loadData();
    const leaflet = await import('leaflet');
    L = leaflet.default ?? leaflet;
    const res = await fetch('/data/hampshire-districts.geojson');
    districtGeo = await res.json();
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

  // Set of MSOA codes that belong to the selected district (for the detail map)
  const districtMsoaCodes = $derived(
    new Set(districtPopRows.map((r) => r.msoaCode))
  );

  // ── Life expectancy headline + trend (Fingertips) ─────────────────────────
  const LE_INDICATOR = 'Life expectancy at birth';

  // Fingertips ships single-year ("2024") AND 3-year pooled ("2014 - 16") rows
  // under the same indicator label. Keep only clean single years for the trend
  // so the two don't interleave into a sawtooth line.
  function isSingleYear(label) {
    return /^\s*\d{4}\s*$/.test(String(label));
  }

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
          r.value != null &&
          isSingleYear(r.year)
      )
      .sort((a, b) => yearKey(a.year) - yearKey(b.year));
  }
  function leTrendEngland(sex) {
    return getTrendByType(districtStore.rows, LE_INDICATOR, 'england', sex, '')
      .filter((r) => isSingleYear(r.year));
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

  // ── Maps ──────────────────────────────────────────────────────────────────
  // Rebuild both maps whenever the district changes (and once Leaflet + geo are ready).
  $effect(() => {
    selectedDistrict; districtGeo; msoaStore.geo;
    if (selectedDistrict && L) {
      buildMaps();
    }
  });

  async function buildMaps() {
    await tick(); // wait for the map containers to exist in the DOM
    buildLocator();
    buildMsoaMap();
  }

  // LEFT: Hampshire districts, chosen one highlighted. No tiles — clean locator.
  function buildLocator() {
    if (!L || !districtGeo || !locatorEl) return;
    if (locatorMap) { locatorMap.remove(); locatorMap = null; }
    locatorMap = L.map(locatorEl, {
      zoomControl: false, attributionControl: false,
      dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
      boxZoom: false, keyboard: false, touchZoom: false
    });
    const layer = L.geoJSON(districtGeo, {
      style: (f) => {
        const isSel = f.properties.LAD23CD === selectedDistrict;
        return {
          fillColor: isSel ? '#206095' : '#e6eef5',
          fillOpacity: isSel ? 0.9 : 0.6,
          color: isSel ? '#003c57' : '#b9c9d6',
          weight: isSel ? 2 : 1
        };
      }
    }).addTo(locatorMap);
    locatorMap.fitBounds(layer.getBounds(), { padding: [8, 8] });
  }

  // RIGHT: just the chosen district's MSOAs, semi-transparent over OSM tiles,
  // with name popups so the geography underneath stays visible.
  function buildMsoaMap() {
    if (!L || !msoaStore.geo || !msoaMapEl) return;
    if (msoaMap) { msoaMap.remove(); msoaMap = null; }
    msoaMap = L.map(msoaMapEl, { scrollWheelZoom: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18
    }).addTo(msoaMap);

    // Build a code→name lookup from the population rows for nicer popups.
    const nameByCode = new Map(districtPopRows.map((r) => [r.msoaCode, r.msoaName]));

    const layer = L.geoJSON(msoaStore.geo, {
      filter: (f) => districtMsoaCodes.has(f.properties.MSOA21CD),
      style: () => ({
        fillColor: '#206095', fillOpacity: 0.35, color: '#206095', weight: 1.5
      }),
      onEachFeature: (f, lyr) => {
        const code = f.properties.MSOA21CD;
        const name = nameByCode.get(code) || f.properties.MSOA21NM || code;
        lyr.bindPopup(`<strong>${name}</strong>`);
        lyr.on({
          mouseover: (e) => e.target.setStyle({ fillOpacity: 0.55, weight: 2.5 }),
          mouseout: (e) => layer.resetStyle(e.target)
        });
      }
    }).addTo(msoaMap);

    const bounds = layer.getBounds();
    if (bounds.isValid()) msoaMap.fitBounds(bounds, { padding: [12, 12] });
    setTimeout(() => msoaMap && msoaMap.invalidateSize(), 0);
  }

  // ── Trend line chart (SVG) ────────────────────────────────────────────────
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
  const stripSVG = $derived.by(() => buildStripPlot(msoaLeStats, msoaLeRows));
</script>

<svelte:head>
  <title>Area Report — Hampshire JSNA</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
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

      <!-- MAPS -->
      <div class="maps-row">
        <figure class="map-fig">
          <figcaption>Where {selectedName} sits in Hampshire</figcaption>
          <div class="locator-map" bind:this={locatorEl}></div>
        </figure>
        <figure class="map-fig">
          <figcaption>MSOAs within {selectedName}</figcaption>
          <div class="msoa-map" bind:this={msoaMapEl}></div>
        </figure>
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
              Each dot is one MSOA. This is a combined male and female
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

  .maps-row { display: flex; gap: 16px; margin-top: 1.25rem; }
  .map-fig { flex: 1; margin: 0; min-width: 0; }
  .map-fig figcaption { font-size: 13px; font-weight: 600; color: #444; margin-bottom: 6px; }
  .locator-map, .msoa-map { height: 320px; width: 100%; border: 1px solid #d9d9d9; background: #f3f3f3; }

  .trend, .variation { margin-top: 1.5rem; }
  .trend-note { font-size: 14px; color: #444; line-height: 1.5; margin-top: 0.5rem; max-width: 62ch; }

  .placeholder, .hint { color: #666; font-style: italic; }
  .source { font-size: 12px; color: #909090; margin-top: 10px; max-width: 62ch; line-height: 1.5; }

  @media (max-width: 760px) {
    .maps-row { flex-direction: column; }
  }
  @media (max-width: 700px) { .stat-strip { flex-direction: column; } }
</style>