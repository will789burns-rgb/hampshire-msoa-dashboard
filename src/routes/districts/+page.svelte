<script>
  import { onMount, tick } from 'svelte';
  import {
    getDistrictStore,
    loadDistrictData,
    getIndicators,
    getSexes,
    getAges,
    defaultSex,
    getLatestYear,
    getDistrictRows,
    getTrendRows,
    getTrendByType,
    getBenchmarkValue
  } from '$lib/districtData.svelte.js';

  const store = getDistrictStore();

  let selectedIndicator = $state('');
  let selectedSex       = $state('');
  let selectedAge       = $state('');
  let selectedDistrict  = $state('E07000086'); // Eastleigh default
  let view              = $state('trend');

  let L;
  let mapEl;
  let map;
  let geoLayer;
  let geo = $state(null);

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

  onMount(async () => {
    await loadDistrictData();
    const leaflet = await import('leaflet');
    L = leaflet.default ?? leaflet;
    const geoRes = await fetch('/data/hampshire-districts.geojson');
    geo = await geoRes.json();
  });

  const indicators = $derived(getIndicators(store.rows));

  $effect(() => {
    if (indicators.length && !indicators.includes(selectedIndicator)) {
      selectedIndicator = indicators[0];
    }
  });

  // Sex/age options for the chosen indicator
  const sexes = $derived(getSexes(store.rows, selectedIndicator));
  const ages  = $derived(getAges(store.rows, selectedIndicator, selectedSex));

  // Keep sex valid + defaulted when indicator changes
  $effect(() => {
    if (sexes.length && !sexes.includes(selectedSex)) {
      selectedSex = defaultSex(sexes);
    }
  });
  // Keep age valid when indicator/sex changes
  $effect(() => {
    if (ages.length && !ages.includes(selectedAge)) {
      selectedAge = ages[0];
    }
  });

  const latestYear = $derived(
    getLatestYear(store.rows, selectedIndicator, selectedSex, selectedAge)
  );
  const districtRows = $derived(
    getDistrictRows(store.rows, selectedIndicator, latestYear, selectedSex, selectedAge)
  );
  const trendRows = $derived(
    getTrendRows(store.rows, selectedIndicator, selectedDistrict, selectedSex, selectedAge)
  );
  const trendHampshire = $derived(
    getTrendByType(store.rows, selectedIndicator, 'county', selectedSex, selectedAge)
  );
  const trendEngland = $derived(
    getTrendByType(store.rows, selectedIndicator, 'england', selectedSex, selectedAge)
  );

  const hampshireVal = $derived(
    getBenchmarkValue(store.rows, selectedIndicator, latestYear, 'county', selectedSex, selectedAge)
  );
  const englandVal = $derived(
    getBenchmarkValue(store.rows, selectedIndicator, latestYear, 'england', selectedSex, selectedAge)
  );

  const selectedName = $derived(DISTRICTS.find(d => d.code === selectedDistrict)?.name ?? '');

  // Benchmark rows sorted by value
  const benchmarkRows = $derived(
    [...districtRows].filter(r => r.value !== null).sort((a, b) => b.value - a.value)
  );
  const benchMax = $derived(
    Math.max(...benchmarkRows.map(r => r.value), hampshireVal ?? 0, englandVal ?? 0) * 1.1 || 1
  );

  // Map colour scale
  const mapVals = $derived(districtRows.map(r => r.value).filter(v => v !== null));
  const mapMin  = $derived(mapVals.length ? Math.min(...mapVals) : 0);
  const mapMax  = $derived(mapVals.length ? Math.max(...mapVals) : 0);

  function colorFor(v) {
    if (v === null || v === undefined) return '#e0e0e0';
    const t = mapMax > mapMin ? (v - mapMin) / (mapMax - mapMin) : 0.5;
    const c1 = [230, 243, 255];
    const c2 = [32, 96, 149];
    const mix = c1.map((a, i) => Math.round(a + (c2[i] - a) * t));
    return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
  }

  function fmt(v) {
    if (v === null || v === undefined) return '—';
    return Number(v).toLocaleString('en-GB', { maximumFractionDigits: 1 });
  }

  // ── Map ──────────────────────────────────────────────────────────────────
  async function showMap() {
    view = 'map';
    await tick();
    await buildMap();
  }
  async function buildMap() {
    await tick();
    if (!L || !geo || !mapEl) return;
    if (map) { map.remove(); map = null; }
    map = L.map(mapEl, { scrollWheelZoom: true }).setView([51.05, -1.3], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);
    drawLayer();
    await tick();
    map.invalidateSize();
  }
  function drawLayer() {
    if (!map || !L || !geo) return;
    if (geoLayer) { geoLayer.remove(); geoLayer = null; }
    const valMap = new Map(districtRows.map(r => [r.area_code, r.value]));
    geoLayer = L.geoJSON(geo, {
      style: (f) => {
        const v = valMap.get(f.properties.LAD23CD);
        return { fillColor: colorFor(v), fillOpacity: v === undefined ? 0.15 : 0.8, color: 'white', weight: 2 };
      },
      onEachFeature: (f, layer) => {
        const code = f.properties.LAD23CD;
        const name = f.properties.LAD23NM;
        const v = valMap.get(code);
        layer.bindPopup(`<strong>${name}</strong><br>${selectedIndicator}<br><strong>${v === undefined ? 'No data' : fmt(v)}</strong>`);
        layer.on({
          mouseover: e => e.target.setStyle({ weight: 3, color: '#333' }),
          mouseout:  e => geoLayer.resetStyle(e.target),
          click:     () => { selectedDistrict = code; }
        });
      }
    }).addTo(map);
    const bounds = geoLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [12, 12] });
  }
  $effect(() => {
    selectedIndicator; districtRows; selectedSex; selectedAge;
    if (view === 'map' && map) drawLayer();
  });
  function switchView(v) {
    if (v !== 'map' && map) { map.remove(); map = null; }
    if (v === 'map') showMap();
    else view = v;
  }

  // ── Trend line chart (SVG) ─────────────────────────────────────────────────
  function buildLineChart(series, width = 640, height = 280) {
    if (!series.length) return '';
    const pad = { top: 20, right: 120, bottom: 40, left: 56 };
    const W = width - pad.left - pad.right;
    const H = height - pad.top - pad.bottom;

    const allYears = [...new Set(series.flatMap(s => s.points.map(p => p.year)))]
      .sort((a, b) => (String(a).match(/\d{4}/)?.[0] ?? 0) - (String(b).match(/\d{4}/)?.[0] ?? 0));
    const allVals = series.flatMap(s => s.points.map(p => p.value)).filter(v => v !== null && v !== undefined);
    if (!allVals.length || allYears.length < 2) return '';

    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const rangeV = maxV - minV || 1;
    const xScale = y => (allYears.indexOf(y) / Math.max(allYears.length - 1, 1)) * W;
    const yScale = v => H - ((v - minV) / rangeV) * H;

    const ticks = 5;
    const yTicks = Array.from({ length: ticks }, (_, i) => minV + (rangeV / (ticks - 1)) * i);

    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:'Open Sans',Arial,sans-serif">`;
    svg += `<g transform="translate(${pad.left},${pad.top})">`;

    for (const t of yTicks) {
      const y = yScale(t);
      svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#e8e8e8" stroke-width="1"/>`;
      svg += `<text x="-8" y="${y + 4}" text-anchor="end" font-size="11" fill="#707070">${fmt(t)}</text>`;
    }
    // Show at most ~6 evenly spaced year labels so they don't overlap.
    const maxLabels = 6;
    const stepEvery = Math.max(1, Math.ceil(allYears.length / maxLabels));
    allYears.forEach((yr, i) => {
      if (i % stepEvery === 0 || i === allYears.length - 1) {
        svg += `<text x="${xScale(yr)}" y="${H + 20}" text-anchor="middle" font-size="11" fill="#707070">${yr}</text>`;
      }
    });

    // First pass: draw the lines and end dots, and collect label positions
    const labels = [];
    for (const s of series) {
      const pts = s.points.filter(p => p.value !== null && p.value !== undefined);
      if (pts.length < 2) continue;
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.year)},${yScale(p.value)}`).join(' ');
      svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width ?? 2}" stroke-dasharray="${s.dash ?? ''}" stroke-linejoin="round" stroke-linecap="round"/>`;
      const last = pts.at(-1);
      svg += `<circle cx="${xScale(last.year)}" cy="${yScale(last.value)}" r="4" fill="${s.color}"/>`;
      labels.push({ y: yScale(last.value), color: s.color, bold: s.bold, label: s.label });
    }

    // Spread labels apart so they don't overlap (minimum 14px gap)
    labels.sort((a, b) => a.y - b.y);
    const minGap = 14;
    for (let i = 1; i < labels.length; i++) {
      if (labels[i].y - labels[i - 1].y < minGap) {
        labels[i].y = labels[i - 1].y + minGap;
      }
    }
    // Keep them inside the chart vertically
    for (const lab of labels) {
      lab.y = Math.max(8, Math.min(H, lab.y));
      svg += `<text x="${W + 8}" y="${lab.y + 4}" font-size="11" fill="${lab.color}" font-weight="${lab.bold ? '700' : '400'}">${lab.label}</text>`;
    }
    svg += `</g></svg>`;
    return svg;
  }

  const trendSVG = $derived.by(() => {
    if (!trendRows.length) return '';
    return buildLineChart([
      { label: selectedName, color: '#206095', width: 2.5, bold: true,
        points: trendRows.map(r => ({ year: r.year, value: r.value })) },
      { label: 'Hampshire', color: '#0f8243', width: 1.5, dash: '5,3',
        points: trendHampshire.map(r => ({ year: r.year, value: r.value })) },
      { label: 'England', color: '#902082', width: 1.5, dash: '3,3',
        points: trendEngland.map(r => ({ year: r.year, value: r.value })) }
    ]);
  });

  // ── Interactive benchmark hover ────────────────────────────────────────────
  let hover = $state(null); // { name, value, compared, x, y }
  function onBarEnter(r, e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const wrap = e.currentTarget.closest('.benchmark').getBoundingClientRect();
    hover = {
      name: r.area_name,
      value: r.value,
      compared: r.compared_to_england,
      x: rect.left - wrap.left + rect.width / 2,
      y: rect.top - wrap.top
    };
  }
  function onBarLeave() { hover = null; }
</script>

<svelte:head>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div class="page">
  <header class="ons-header">
    <div class="ons-header__inner">
      <a href="/" class="back-link">← Back to all tools</a>
      <h1>District Local Statistics</h1>
      <p class="ons-header__sub">Hampshire district-level indicators · Source: OHID Fingertips</p>
    </div>
  </header>

  <div class="layout">
    <nav class="sidebar" aria-label="Districts">
      <p class="sidebar__label">Select district</p>
      {#each DISTRICTS as d}
        <button class="nav-item" class:active={selectedDistrict === d.code} onclick={() => (selectedDistrict = d.code)}>{d.name}</button>
      {/each}
    </nav>

    <main class="content">
      {#if store.loading}
        <p class="status">Loading data…</p>
      {:else if store.error}
        <div class="error"><strong>Couldn't load data.</strong><p>{store.error}</p></div>
      {:else}
        <div class="content-header">
          <h2>{selectedName}</h2>
          <div class="controls">
            <label class="field">
              <span>Indicator</span>
              <select bind:value={selectedIndicator}>
                {#each indicators as ind}<option value={ind}>{ind}</option>{/each}
              </select>
            </label>
            {#if sexes.length > 1}
              <label class="field">
                <span>Sex</span>
                <select bind:value={selectedSex}>
                  {#each sexes as s}<option value={s}>{s}</option>{/each}
                </select>
              </label>
            {/if}
            {#if ages.length > 1}
              <label class="field">
                <span>Age</span>
                <select bind:value={selectedAge}>
                  {#each ages as a}<option value={a}>{a}</option>{/each}
                </select>
              </label>
            {/if}
          </div>
        </div>

        {#if latestYear}
          {@const myRow = districtRows.find(r => r.area_code === selectedDistrict)}
          <div class="stat-strip">
            <div class="stat-card">
              <div class="stat-card__label">{selectedName}</div>
              <div class="stat-card__value">{fmt(myRow?.value)}</div>
              <div class="stat-card__year">{latestYear}</div>
            </div>
            <div class="stat-card stat-card--bench">
              <div class="stat-card__label">Hampshire</div>
              <div class="stat-card__value">{fmt(hampshireVal)}</div>
              <div class="stat-card__year">{latestYear}</div>
            </div>
            <div class="stat-card stat-card--eng">
              <div class="stat-card__label">England</div>
              <div class="stat-card__value">{fmt(englandVal)}</div>
              <div class="stat-card__year">{latestYear}</div>
            </div>
          </div>
        {/if}

        <div class="tabs">
          <button class="tab" class:active={view === 'trend'} onclick={() => switchView('trend')}>Trend</button>
          <button class="tab" class:active={view === 'benchmark'} onclick={() => switchView('benchmark')}>Benchmark</button>
          <button class="tab" class:active={view === 'map'} onclick={() => switchView('map')}>Map</button>
        </div>

        {#if view === 'trend'}
          <div class="chart-wrap">
            {#if trendSVG}
              {@html trendSVG}
              <div class="legend-row">
                <span class="legend-item" style="--c:#206095">{selectedName}</span>
                <span class="legend-item" style="--c:#0f8243">Hampshire (dashed)</span>
                <span class="legend-item" style="--c:#902082">England (dashed)</span>
              </div>
            {:else}
              <p class="status">No multi-year trend available for this selection.</p>
            {/if}
          </div>

        {:else if view === 'benchmark'}
          <div class="benchmark">
            {#each benchmarkRows as r}
              {@const isSelected = r.area_code === selectedDistrict}
              <div class="bm-row" class:bm-row--selected={isSelected}>
                <span class="bm-name">{r.area_name}</span>
                <div class="bm-track">
                  <button
                    class="bm-fill"
                    style="width:{(r.value / benchMax) * 100}%;background:{isSelected ? '#206095' : '#b3cce0'}"
                    onmouseenter={(e) => onBarEnter(r, e)}
                    onmouseleave={onBarLeave}
                    onclick={() => (selectedDistrict = r.area_code)}
                    aria-label={`${r.area_name}: ${fmt(r.value)}`}
                  ></button>
                  {#if hampshireVal}
                    <div class="bm-marker bm-marker--county" style="left:{(hampshireVal / benchMax) * 100}%"></div>
                  {/if}
                  {#if englandVal}
                    <div class="bm-marker bm-marker--england" style="left:{(englandVal / benchMax) * 100}%"></div>
                  {/if}
                </div>
                <span class="bm-val">{fmt(r.value)}</span>
              </div>
            {/each}

            {#if hover}
              <div class="bm-tip" style="left:{hover.x}px;top:{hover.y}px;">
                <strong>{hover.name}</strong><br />
                {fmt(hover.value)}
                {#if hover.compared && hover.compared !== 'Not compared'}<br /><span class="bm-tip__cmp">{hover.compared}</span>{/if}
              </div>
            {/if}

            <div class="bm-key">
              <span class="bm-key__item"><span class="bm-key__line bm-key__line--county"></span> Hampshire avg {fmt(hampshireVal)}</span>
              <span class="bm-key__item"><span class="bm-key__line bm-key__line--england"></span> England avg {fmt(englandVal)}</span>
            </div>
            <p class="source">Latest available year: {latestYear} · Source: OHID Fingertips</p>
          </div>

        {:else if view === 'map'}
          {#key view}
            <div class="map" bind:this={mapEl}></div>
          {/key}
          {#if mapVals.length}
            <div class="legend">
              <div class="legend-title">{selectedIndicator} · {latestYear}</div>
              <div class="legend-bar"></div>
              <div class="legend-ticks">
                <span>{fmt(mapMin)}</span><span>{fmt((mapMin + mapMax) / 2)}</span><span>{fmt(mapMax)}</span>
              </div>
            </div>
          {/if}
        {/if}
      {/if}
    </main>
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap');

  :global(body) { margin: 0; font-family: 'Open Sans', Arial, sans-serif; color: #222; background: #fff; -webkit-font-smoothing: antialiased; }
  .page { min-height: 100vh; }

  .ons-header { border-bottom: 1px solid #d9d9d9; box-shadow: inset 0 -8px 0 #206095; background: #fff; }
  .ons-header__inner { max-width: 1200px; margin: 0 auto; padding: 24px 24px 28px; }
  .ons-header h1 { margin: 0; font-size: 30px; font-weight: 700; color: #222; }
  .ons-header__sub { margin: 6px 0 0; color: #555; font-size: 16px; }

  .layout { max-width: 1200px; margin: 0 auto; display: flex; gap: 32px; padding: 28px 24px 64px; align-items: flex-start; }

  .sidebar { flex: 0 0 200px; display: flex; flex-direction: column; border-top: 1px solid #d9d9d9; }
  .sidebar__label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #707070; padding: 10px 14px 6px; }
  .nav-item { text-align: left; background: none; border: none; border-bottom: 1px solid #d9d9d9; border-left: 4px solid transparent; padding: 10px 14px; font: inherit; font-size: 14px; color: #206095; cursor: pointer; }
  .nav-item:hover { background: #f3f3f3; }
  .nav-item.active { background: #eaf2f8; border-left-color: #206095; color: #003c57; font-weight: 700; }
  .nav-item:focus-visible { outline: 3px solid #fbc900; outline-offset: -3px; }

  .content { flex: 1 1 auto; min-width: 0; }
  .content-header { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
  .content-header h2 { margin: 0; font-size: 24px; color: #222; }

  .controls { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; }
  .field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
  .field span { font-weight: 600; }
  select { font: inherit; font-size: 15px; padding: 9px 10px; border: 2px solid #222; border-radius: 0; background: #fff; min-width: 180px; }
  select:focus { outline: 3px solid #fbc900; box-shadow: inset 0 0 0 1px #222; }

  .stat-strip { display: flex; gap: 1px; background: #d9d9d9; border: 1px solid #d9d9d9; margin-bottom: 20px; }
  .stat-card { flex: 1; background: #fff; padding: 14px 18px; border-top: 4px solid #206095; }
  .stat-card--bench { border-top-color: #0f8243; }
  .stat-card--eng { border-top-color: #902082; }
  .stat-card__label { font-size: 13px; color: #555; margin-bottom: 4px; }
  .stat-card__value { font-size: 28px; font-weight: 700; color: #222; line-height: 1; }
  .stat-card__year { font-size: 12px; color: #909090; margin-top: 4px; }

  .tabs { display: flex; gap: 4px; border-bottom: 2px solid #222; margin-bottom: 16px; }
  .tab { font: inherit; font-size: 15px; font-weight: 600; background: none; border: none; padding: 10px 18px; cursor: pointer; color: #206095; border-bottom: 3px solid transparent; margin-bottom: -2px; }
  .tab:hover { background: #f3f3f3; }
  .tab.active { color: #003c57; border-bottom-color: #206095; }

  .chart-wrap { margin-bottom: 16px; }
  .legend-row { display: flex; gap: 20px; margin-top: 10px; flex-wrap: wrap; }
  .legend-item { font-size: 13px; color: var(--c); display: flex; align-items: center; gap: 6px; }
  .legend-item::before { content: ''; display: inline-block; width: 24px; height: 3px; background: var(--c); border-radius: 2px; }

  .benchmark { display: flex; flex-direction: column; gap: 6px; position: relative; }
  .bm-row { display: flex; align-items: center; gap: 10px; padding: 3px 0; }
  .bm-row--selected .bm-name { font-weight: 700; color: #206095; }
  .bm-name { width: 170px; font-size: 13px; color: #333; flex-shrink: 0; }
  .bm-track { flex: 1; height: 22px; background: #f3f3f3; border: 1px solid #e0e0e0; position: relative; overflow: visible; }
  .bm-fill { height: 100%; border: none; padding: 0; cursor: pointer; display: block; transition: width 0.3s ease, filter 0.15s; }
  .bm-fill:hover { filter: brightness(0.9); }
  .bm-fill:focus-visible { outline: 2px solid #fbc900; }
  .bm-marker { position: absolute; top: -4px; bottom: -4px; width: 2px; z-index: 2; pointer-events: none; }
  .bm-marker--county { background: #0f8243; }
  .bm-marker--england { background: #902082; }
  .bm-val { width: 52px; text-align: right; font-size: 13px; font-weight: 700; color: #222; flex-shrink: 0; }
  .bm-key { display: flex; gap: 20px; margin-top: 10px; flex-wrap: wrap; }
  .bm-key__item { font-size: 12px; color: #555; display: flex; align-items: center; gap: 6px; }
  .bm-key__line { display: inline-block; width: 20px; height: 3px; }
  .bm-key__line--county { background: #0f8243; }
  .bm-key__line--england { background: #902082; }

  .bm-tip { position: absolute; transform: translate(-50%, -110%); background: #222; color: #fff; font-size: 12px; padding: 6px 9px; border-radius: 3px; pointer-events: none; white-space: nowrap; z-index: 10; }
  .bm-tip__cmp { color: #ffd; }

  .map { height: 500px; width: 100%; border: 1px solid #d9d9d9; }
  .legend { margin-top: 12px; max-width: 280px; }
  .legend-title { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 6px; }
  .legend-bar { height: 14px; width: 100%; background: linear-gradient(to right, #e6f3ff, #206095); border: 1px solid #ccc; }
  .legend-ticks { display: flex; justify-content: space-between; font-size: 12px; color: #555; margin-top: 4px; }

  .status { color: #707070; }
  .source { font-size: 12px; color: #909090; margin-top: 10px; }
  .error { background: #fbeceb; border-left: 4px solid #d4351c; padding: 16px; }

  @media (max-width: 820px) {
    .layout { flex-direction: column; gap: 16px; }
    .sidebar { flex-basis: auto; flex-direction: row; flex-wrap: wrap; border-top: none; }
    .nav-item { border-left: none; border-bottom: 3px solid transparent; flex: 1 1 auto; text-align: center; }
    .nav-item.active { border-left: none; border-bottom-color: #206095; }
    select { min-width: 0; width: 100%; }
    .content-header { flex-direction: column; align-items: flex-start; }
    .bm-name { width: 110px; }
  }
</style>