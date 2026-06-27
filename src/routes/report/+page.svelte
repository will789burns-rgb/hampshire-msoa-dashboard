<script>
  import { onMount, tick } from 'svelte';
  import { getDistrictStore, loadDistrictData } from '$lib/districtData.svelte.js';
  import { getStore, loadData } from '$lib/data.svelte.js';
  import { fmtInt } from '$lib/charts.svelte.js';
  import { MEASURES } from '$lib/measures.js';
  import MeasureSection from '$lib/MeasureSection.svelte';

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
  let locatorEl;
  let msoaMapEl;
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

  const districtMsoaCodes = $derived(new Set(districtPopRows.map((r) => r.msoaCode)));

  // ── Maps ──────────────────────────────────────────────────────────────────
  $effect(() => {
    selectedDistrict; districtGeo; msoaStore.geo;
    if (selectedDistrict && L) {
      buildMaps();
    }
  });

  async function buildMaps() {
    await tick();
    buildLocator();
    buildMsoaMap();
  }

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

  function buildMsoaMap() {
    if (!L || !msoaStore.geo || !msoaMapEl) return;
    if (msoaMap) { msoaMap.remove(); msoaMap = null; }
    msoaMap = L.map(msoaMapEl, { scrollWheelZoom: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18
    }).addTo(msoaMap);

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

    <!-- MEASURES — one section per config entry -->
    {#each MEASURES as m (m.key)}
      <MeasureSection
        title={m.title}
        intro={m.intro}
        fingertipsIndicator={m.fingertipsIndicator}
        sexes={m.sexes}
        hasHeadline={m.hasHeadline}
        hasTrend={m.hasTrend}
        allowVariation={m.allowVariation}
        msoaIndicator={m.msoaIndicator}
        variationNote={m.variationNote}
        unit={m.unit}
        districtRows={districtStore.rows}
        msoaRows={msoaStore.rows}
        {selectedDistrict}
        {selectedName}
      />
    {/each}
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

  .overview { border-top: 4px solid #206095; padding-top: 1rem; margin-top: 2rem; }
  .overview h2 { color: #222; margin: 0 0 0.5rem; font-size: 24px; }
  .lede { font-size: 1.05rem; line-height: 1.55; max-width: 62ch; }

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

  .hint { color: #666; font-style: italic; }

  @media (max-width: 760px) {
    .maps-row { flex-direction: column; }
  }
  @media (max-width: 700px) { .stat-strip { flex-direction: column; } }
</style>