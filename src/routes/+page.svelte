<script>
  import { onMount } from 'svelte';
  import Papa from 'papaparse';

  const SECTIONS = [
    'Demography',
    'Births and Deaths',
    'Lives',
    'People',
    'Place',
    'Major conditions'
  ];

  let rows = $state([]);
  let loading = $state(true);
  let loadError = $state('');
  let selectedTopic = $state('Demography');
  let selectedIndicator = $state('');
  let search = $state('');

  onMount(async () => {
    try {
      // Load the friendly MSOA names first and build a code -> name lookup
      const nameLookup = new Map();
      try {
        const nameRes = await fetch('/data/msoa-names.csv');
        if (nameRes.ok) {
          let nameText = await nameRes.text();
          nameText = nameText.replace(/^\uFEFF/, '');
          const nameParsed = Papa.parse(nameText, { header: true, skipEmptyLines: true });
          for (const n of nameParsed.data) {
            const code = (n['msoa21cd'] ?? '').trim();
            const friendly = (n['msoa21hclnm'] ?? '').trim();
            if (code) nameLookup.set(code, friendly);
          }
        }
      } catch (e) {
        // If names file is missing, we fall back to the code-based label
      }

      const res = await fetch('/data/msoa-summary.csv');
      if (!res.ok) throw new Error('Could not find /data/msoa-summary.csv');
      let text = await res.text();
      text = text.replace(/^\uFEFF/, '');
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      rows = parsed.data.map((r) => {
        const code = (r['MSOACD21'] ?? '').trim();
        const friendly = nameLookup.get(code);
        return {
          district: (r['District'] ?? '').trim(),
          msoaName: friendly || (r['MSOA21'] ?? '').trim(),
          msoaCode: code,
          topic: (r['Topic'] ?? '').trim(),
          indicator: (r['Indicator'] ?? '').trim(),
          measure: (r['Measure'] ?? '').trim(),
          source: (r['Source'] ?? '').trim(),
          value: r['Value'],
          lowerCI: r['Lower CI'],
          upperCI: r['Upper CI']
        };
      });
    } catch (e) {
      loadError = e.message;
    } finally {
      loading = false;
    }
  });

  const indicators = $derived(
    [...new Set(rows.filter((r) => r.topic === selectedTopic).map((r) => r.indicator))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  );

  $effect(() => {
    if (indicators.length && !indicators.includes(selectedIndicator)) {
      selectedIndicator = indicators[0];
    }
  });

  const currentRows = $derived(
    rows.filter(
      (r) => r.topic === selectedTopic && r.indicator === selectedIndicator && r.msoaCode
    )
  );

  const tableRows = $derived(
    currentRows.filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return r.msoaName.toLowerCase().includes(q) || r.district.toLowerCase().includes(q);
    })
  );

  const measureNote = $derived(currentRows.find((r) => r.measure)?.measure ?? '');
  const sourceNote = $derived(currentRows.find((r) => r.source)?.source ?? '');

  function fmt(v) {
    if (v === null || v === undefined || String(v).trim() === '') return '—';
    const n = Number(v);
    if (Number.isNaN(n)) return v;
    return n.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  }

  function selectTopic(t) {
    selectedTopic = t;
    search = '';
  }

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

<div class="page">
  <header class="ons-header">
    <div class="ons-header__inner">
      <h1>JSNA Area Case Study Tool</h1>
      <p class="ons-header__sub">MSOA-level data summary across Hampshire</p>
    </div>
  </header>

  <div class="layout">
    <nav class="sidebar" aria-label="Sections">
      {#each SECTIONS as section}
        <button
          class="nav-item"
          class:active={selectedTopic === section}
          onclick={() => selectTopic(section)}
        >
          {section}
        </button>
      {/each}
    </nav>

    <main class="content">
      {#if loading}
        <p class="status">Loading data…</p>
      {:else if loadError}
        <div class="error">
          <strong>Couldn’t load the data.</strong>
          <p>{loadError}</p>
          <p>Check the file is saved at <code>static/data/msoa-summary.csv</code>.</p>
        </div>
      {:else}
        <h2>{selectedTopic}</h2>

        <div class="controls">
          <label class="field">
            <span>Indicator</span>
            <select bind:value={selectedIndicator}>
              {#each indicators as ind}
                <option value={ind}>{ind}</option>
              {/each}
            </select>
          </label>

          <label class="field">
            <span>Search area</span>
            <input type="text" placeholder="MSOA or district…" bind:value={search} />
          </label>

          <button class="btn" onclick={downloadCsv}>Download CSV</button>
        </div>

        {#if measureNote}
          <p class="measure">{measureNote}</p>
        {/if}

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>District</th>
                <th>MSOA</th>
                <th>Code</th>
                <th class="num">Value</th>
                <th class="num">Lower CI</th>
                <th class="num">Upper CI</th>
              </tr>
            </thead>
            <tbody>
              {#each tableRows as r (r.msoaCode)}
                <tr>
                  <td>{r.district}</td>
                  <td>{r.msoaName}</td>
                  <td>{r.msoaCode}</td>
                  <td class="num">{fmt(r.value)}</td>
                  <td class="num">{fmt(r.lowerCI)}</td>
                  <td class="num">{fmt(r.upperCI)}</td>
                </tr>
              {/each}
              {#if tableRows.length === 0}
                <tr><td colspan="6" class="empty">No data for this selection.</td></tr>
              {/if}
            </tbody>
          </table>
        </div>

        <p class="rowcount">{tableRows.length} areas shown</p>
        {#if sourceNote}<p class="source">{sourceNote}</p>{/if}
      {/if}
    </main>
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap');

  :global(body) {
    margin: 0;
    font-family: 'Open Sans', Arial, sans-serif;
    color: #222;
    background: #fff;
    -webkit-font-smoothing: antialiased;
  }

  .page { min-height: 100vh; }

  .ons-header {
    border-bottom: 1px solid #d9d9d9;
    box-shadow: inset 0 -8px 0 #206095;
    background: #fff;
  }
  .ons-header__inner { max-width: 1200px; margin: 0 auto; padding: 24px 24px 28px; }
  .ons-header h1 { margin: 0; font-size: 30px; font-weight: 700; color: #222; }
  .ons-header__sub { margin: 6px 0 0; color: #555; font-size: 16px; }

  .layout {
    max-width: 1200px; margin: 0 auto; display: flex; gap: 32px;
    padding: 28px 24px 64px; align-items: flex-start;
  }

  .sidebar {
    flex: 0 0 230px; display: flex; flex-direction: column;
    border-top: 1px solid #d9d9d9;
  }
  .nav-item {
    text-align: left; background: none; border: none;
    border-bottom: 1px solid #d9d9d9; border-left: 4px solid transparent;
    padding: 12px 14px; font: inherit; font-size: 15px; color: #206095; cursor: pointer;
  }
  .nav-item:hover { background: #f3f3f3; }
  .nav-item.active {
    background: #eaf2f8; border-left-color: #206095; color: #003c57; font-weight: 700;
  }
  .nav-item:focus-visible { outline: 3px solid #fbc900; outline-offset: -3px; }

  .content { flex: 1 1 auto; min-width: 0; }
  .content h2 { margin: 0 0 18px; font-size: 24px; color: #222; }

  .controls {
    display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; margin-bottom: 18px;
  }
  .field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
  .field span { font-weight: 600; }
  select, input[type='text'] {
    font: inherit; font-size: 15px; padding: 9px 10px;
    border: 2px solid #222; border-radius: 0; background: #fff; min-width: 260px;
  }
  input[type='text'] { min-width: 200px; }
  select:focus, input:focus {
    outline: 3px solid #fbc900; outline-offset: 0; box-shadow: inset 0 0 0 1px #222;
  }

  .btn {
    font: inherit; font-weight: 600; font-size: 15px; color: #fff;
    background: #0f8243; border: none; padding: 11px 18px; cursor: pointer;
  }
  .btn:hover { background: #0c6e39; }
  .btn:focus-visible { outline: 3px solid #fbc900; outline-offset: 0; }

  .measure {
    margin: 0 0 16px; padding: 10px 14px; background: #f5f5f6;
    border-left: 4px solid #206095; font-size: 14px; color: #444;
  }

  .table-wrap { overflow-x: auto; border-top: 2px solid #222; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  thead th {
    text-align: left; padding: 10px 12px; border-bottom: 2px solid #222;
    font-weight: 700; white-space: nowrap;
  }
  tbody td { padding: 9px 12px; border-bottom: 1px solid #d9d9d9; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:hover { background: #f5f5f6; }
  .empty { text-align: center; color: #707070; padding: 24px; }

  .rowcount { font-size: 13px; color: #707070; margin: 10px 0 0; }
  .source { font-size: 12px; color: #909090; margin: 4px 0 0; }

  .status { color: #707070; }
  .error { background: #fbeceb; border-left: 4px solid #d4351c; padding: 16px; }
  .error code { background: #fff; padding: 1px 4px; }

  @media (max-width: 820px) {
    .layout { flex-direction: column; gap: 16px; }
    .sidebar { flex-basis: auto; flex-direction: row; flex-wrap: wrap; border-top: none; }
    .nav-item { border-left: none; border-bottom: 3px solid transparent; flex: 1 1 auto; }
    .nav-item.active { border-left: none; border-bottom-color: #206095; }
    select, input[type='text'] { min-width: 0; width: 100%; }
    .field { flex: 1 1 200px; }
  }
</style>