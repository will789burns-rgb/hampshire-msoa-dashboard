<script>
  import { onMount, tick } from 'svelte';
  import { getStore, loadData } from '$lib/data.svelte.js';
  import DataTable from '$lib/DataTable.svelte';
  import ChartView from '$lib/ChartView.svelte';
  const store = getStore();

  const SECTIONS = ['Demography', 'Births and Deaths', 'Lives', 'People', 'Place', 'Major conditions'];

  let selectedTopic = $state('Demography');
  let selectedIndicator = $state('');
  let search = $state('');
  let view = $state('table');
  let districtFilter = $state('');

  let L;
  let mapEl;
  let map;
  let geoLayer;

  onMount(async () => {
    await loadData();
    const leaflet = await import('leaflet');
    L = leaflet.default ?? leaflet;
  });

  const districts = $derived(
    [...new Set(store.rows.map((r) => r.district))].filter(Boolean).sort((a, b) => a.localeCompare(b))
  );

  const indicators = $derived(
    [...new Set(store.rows.filter((r) => r.topic === selectedTopic).map((r) => r.indicator))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  );

  $effect(() => {
    if (indicators.length && !indicators.includes(selectedIndicator)) {
      selectedIndicator = indicators[0];
    }
  });

  const indicatorRows = $derived(
    store.rows.filter((r) => r.topic === selectedTopic && r.indicator === selectedIndicator && r.msoaCode)
  );

  const currentRows = $derived(
    districtFilter ? indicatorRows.filter((r) => r.district === districtFilter) : indicatorRows
  );

  const tableRows = $derived(
    currentRows.filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return r.msoaName.toLowerCase().includes(q) || r.district.toLowerCase().includes(q);
    })
  );

  const measureNote = $derived(indicatorRows.find((r) => r.measure)?.measure ?? '');
  const sourceNote = $derived(indicatorRows.find((r) => r.source)?.source ?? '');

  const valueByCode = $derived(
    new Map(indicatorRows.map((r) => [r.msoaCode, Number(r.value)]).filter(([, v]) => !Number.isNaN(v)))
  );

  const visibleCodes = $derived(new Set(currentRows.map((r) => r.msoaCode)));

  const stats = $derived.by(() => {
    const vals = [...valueByCode.values()];
    if (!vals.length) return { min: 0, max: 0, avg: 0, mid: 0 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { min, max, avg, mid: (min + max) / 2 };
  });

  const chartData = $derived.by(() => {
    return indicatorRows
      .map((r) => ({
        name: r.msoaName,
        district: r.district,
        value: Number(r.value),
        inFilter: !districtFilter || r.district === districtFilter
      }))
      .filter((d) => !Number.isNaN(d.value))
      .sort((a, b) => b.value - a.value);
  });

  function fmt(v) {
    if (v === null || v === undefined || String(v).trim() === '') return '—';
    const n = Number(v);
    if (Number.isNaN(n)) return v;
    return n.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  }

  function colorFor(v, min, max) {
    if (v === undefined || Number.isNaN(v)) return '#e0e0e0';
    const t = max > min ? (v - min) / (max - min) : 0.5;
    const c1 = [230, 243, 255];
    const c2 = [32, 96, 149];
    const mix = c1.map((a, i) => Math.round(a + (c2[i] - a) * t));
    return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
  }

  function selectTopic(t) {
    selectedTopic = t;
    search = '';
  }

  async function showMap() { view = 'map'; await buildMap(); }
  function showTable() { view = 'table'; if (map) { map.remove(); map = null; } }
  function showChart() { view = 'chart'; if (map) { map.remove(); map = null; } }

  async function buildMap() {
    await tick();
    if (!L || !store.geo || !mapEl) return;
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
    if (!map || !L || !store.geo) return;
    if (geoLayer) { geoLayer.remove(); geoLayer = null; }
    const { min, max } = stats;
    geoLayer = L.geoJSON(store.geo, {
      filter: (f) => visibleCodes.has(f.properties.MSOA21CD),
      style: (f) => {
        const v = valueByCode.get(f.properties.MSOA21CD);
        return { fillColor: colorFor(v, min, max), fillOpacity: v === undefined ? 0.15 : 0.8, color: 'white', weight: 1 };
      },
      onEachFeature: (f, layer) => {
        const code = f.properties.MSOA21CD;
        const v = valueByCode.get(code);
        const row = indicatorRows.find((r) => r.msoaCode === code);
        const name = row ? row.msoaName : f.properties.MSOA21NM ?? code;
        const dist = row ? row.district : '';
        layer.bindPopup(`<strong>${name}</strong><br>${dist ? dist + '<br>' : ''}${selectedIndicator}: <strong>${v === undefined ? 'No data' : fmt(v)}</strong>`);
        layer.on({
          mouseover: (e) => e.target.setStyle({ weight: 3, color: '#333' }),
          mouseout: (e) => geoLayer.resetStyle(e.target)
        });
      }
    }).addTo(map);
    const bounds = geoLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [12, 12] });
  }

  $effect(() => {
    selectedIndicator; districtFilter; visibleCodes; valueByCode;
    if (view === 'map' && map) drawLayer();
  });

  function downloadCsv() {
    const header = ['District', 'MSOA', 'MSOA Code', 'Value', 'Lower CI', 'Upper CI'];
    const lines = [header.join(',')];
    for (const r of tableRows) {
      const cells = [r.district, r.msoaName, r.msoaCode, r.value, r.lowerCI, r.upperCI].map((c) => {
        const s = c === null || c === undefined ? '' : String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      });
      lines.push(cells.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (selectedIndicator || 'data').replace(/[^a-z0-9]+/gi, '_') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div class="page">
  <header class="ons-header">
    <div class="ons-header__inner">
      <a href="/" class="back-link">← Back to all tools</a>
      <h1>JSNA Area Case Study Tool</h1>
      <p class="ons-header__sub">MSOA-level data summary across Hampshire</p>
    </div>
  </header>

  <div class="layout">
    <nav class="sidebar" aria-label="Sections">
      {#each SECTIONS as section}
        <button class="nav-item" class:active={selectedTopic === section} onclick={() => selectTopic(section)}>{section}</button>
      {/each}
    </nav>

    <main class="content">
      {#if store.loading}
        <p class="status">Loading data…</p>
      {:else if store.error}
        <div class="error"><strong>Couldn’t load the data.</strong><p>{store.error}</p></div>
      {:else}
        <h2>{selectedTopic}</h2>

        <div class="controls">
          <label class="field">
            <span>Indicator</span>
            <select bind:value={selectedIndicator}>
              {#each indicators as ind}<option value={ind}>{ind}</option>{/each}
            </select>
          </label>

          <label class="field">
            <span>District</span>
            <select bind:value={districtFilter}>
              <option value="">All districts</option>
              {#each districts as d}<option value={d}>{d}</option>{/each}
            </select>
          </label>

          {#if view === 'table'}
            <label class="field">
              <span>Search area</span>
              <input type="text" placeholder="MSOA or district…" bind:value={search} />
            </label>
          {/if}

          <button class="btn" onclick={downloadCsv}>Download CSV</button>
        </div>

        {#if measureNote}<p class="measure">{measureNote}</p>{/if}

        <div class="tabs">
          <button class="tab" class:active={view === 'table'} onclick={showTable}>Table</button>
          <button class="tab" class:active={view === 'map'} onclick={showMap}>Map</button>
          <button class="tab" class:active={view === 'chart'} onclick={showChart}>Chart</button>
        </div>

        {#if view === 'table'}
          <DataTable rows={tableRows} {fmt} />
          <p class="rowcount">{tableRows.length} areas shown</p>

        {:else if view === 'map'}
          {#key view}
            <div class="map" bind:this={mapEl}></div>
          {/key}
          {#if !store.geo}
            <p class="status">Map boundaries not found at <code>static/data/msoa-boundaries.geojson</code>.</p>
          {:else if valueByCode.size}
            <div class="legend">
              <div class="legend-title">{selectedIndicator}</div>
              <div class="legend-bar"></div>
              <div class="legend-ticks"><span>{fmt(stats.min)}</span><span>{fmt(stats.mid)}</span><span>{fmt(stats.max)}</span></div>
              <div class="legend-avg">Hampshire average: <strong>{fmt(stats.avg)}</strong></div>
            </div>
          {/if}

        {:else}
          <ChartView {chartData} {stats} {districtFilter} {fmt} />
        {/if}

        {#if sourceNote}<p class="source">{sourceNote}</p>{/if}
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

  .sidebar { flex: 0 0 230px; display: flex; flex-direction: column; border-top: 1px solid #d9d9d9; }
  .nav-item { text-align: left; background: none; border: none; border-bottom: 1px solid #d9d9d9; border-left: 4px solid transparent; padding: 12px 14px; font: inherit; font-size: 15px; color: #206095; cursor: pointer; }
  .nav-item:hover { background: #f3f3f3; }
  .nav-item.active { background: #eaf2f8; border-left-color: #206095; color: #003c57; font-weight: 700; }
  .nav-item:focus-visible { outline: 3px solid #fbc900; outline-offset: -3px; }

  .content { flex: 1 1 auto; min-width: 0; }
  .content h2 { margin: 0 0 18px; font-size: 24px; color: #222; }

  .controls { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; margin-bottom: 18px; }
  .field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
  .field span { font-weight: 600; }
  select, input[type='text'] { font: inherit; font-size: 15px; padding: 9px 10px; border: 2px solid #222; border-radius: 0; background: #fff; min-width: 220px; }
  input[type='text'] { min-width: 200px; }
  select:focus, input:focus { outline: 3px solid #fbc900; box-shadow: inset 0 0 0 1px #222; }

  .btn { font: inherit; font-weight: 600; font-size: 15px; color: #fff; background: #0f8243; border: none; padding: 11px 18px; cursor: pointer; }
  .btn:hover { background: #0c6e39; }
  .btn:focus-visible { outline: 3px solid #fbc900; }

  .measure { margin: 0 0 16px; padding: 10px 14px; background: #f5f5f6; border-left: 4px solid #206095; font-size: 14px; color: #444; }

  .tabs { display: flex; gap: 4px; border-bottom: 2px solid #222; margin-bottom: 16px; }
  .tab { font: inherit; font-size: 15px; font-weight: 600; background: none; border: none; padding: 10px 18px; cursor: pointer; color: #206095; border-bottom: 3px solid transparent; margin-bottom: -2px; }
  .tab:hover { background: #f3f3f3; }
  .tab.active { color: #003c57; border-bottom-color: #206095; }

  .map { height: 560px; width: 100%; border: 1px solid #d9d9d9; }
  .legend { margin-top: 12px; max-width: 280px; }
  .legend-title { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 6px; }
  .legend-bar { height: 14px; width: 100%; background: linear-gradient(to right, #e6f3ff, #206095); border: 1px solid #ccc; }
  .legend-ticks { display: flex; justify-content: space-between; font-size: 12px; color: #555; margin-top: 4px; }
  .legend-avg { font-size: 13px; color: #206095; margin-top: 8px; }

  .rowcount { font-size: 13px; color: #707070; margin: 10px 0 0; }
  .source { font-size: 12px; color: #909090; margin: 8px 0 0; }
  .status { color: #707070; }
  .error { background: #fbeceb; border-left: 4px solid #d4351c; padding: 16px; }

  @media (max-width: 820px) {
    .layout { flex-direction: column; gap: 16px; }
    .sidebar { flex-basis: auto; flex-direction: row; flex-wrap: wrap; border-top: none; }
    .nav-item { border-left: none; border-bottom: 3px solid transparent; flex: 1 1 auto; }
    .nav-item.active { border-left: none; border-bottom-color: #206095; }
    select, input[type='text'] { min-width: 0; width: 100%; }
    .field { flex: 1 1 200px; }
  }
</style>