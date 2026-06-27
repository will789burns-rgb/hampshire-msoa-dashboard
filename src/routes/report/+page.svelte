<script>
  import { onMount } from 'svelte';
  import { getDistrictStore, loadDistrictData } from '$lib/districtData.svelte.js';
  import { getStore, loadData } from '$lib/data.svelte.js';

  const districtStore = getDistrictStore(); // Fingertips (used in later steps)
  const msoaStore = getStore();             // MSOA summary

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

  let selectedDistrict = $state(''); // holds the area_code; '' = nothing chosen yet

  const selectedName = $derived(
    DISTRICTS.find((d) => d.code === selectedDistrict)?.name ?? ''
  );

  onMount(() => {
    loadDistrictData(); // Fingertips, ready for later sections
    loadData();         // MSOA summary, used by the overview below
  });

  // ── Population overview (derived from MSOA data) ──────────────────────────
  // IMPORTANT: match the indicator EXACTLY. The file also contains
  // "Total resident population >65yrs (2023)" which must NOT be summed in.
  const POP_INDICATOR = 'Total resident population (2023)';

  const popRows = $derived(
    msoaStore.rows.filter(
      (r) =>
        r.indicator === POP_INDICATOR &&
        r.msoaCode &&                       // only true MSOA rows
        !Number.isNaN(Number(r.value))
    )
  );

  const districtPopRows = $derived(
    popRows.filter((r) => r.district === selectedName)
  );

  const districtPopulation = $derived(
    districtPopRows.reduce((sum, r) => sum + Number(r.value), 0)
  );

  const msoaCount = $derived(districtPopRows.length);

  const hampshirePopulation = $derived(
    popRows.reduce((sum, r) => sum + Number(r.value), 0)
  );

  const popShare = $derived(
    hampshirePopulation ? (districtPopulation / hampshirePopulation) * 100 : 0
  );

  function fmtInt(v) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
    return Number(v).toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }
</script>

<svelte:head>
  <title>Area Report — Hampshire JSNA</title>
</svelte:head>

<main class="report">
  <h1>Area Report</h1>
  <p class="intro">
    Choose a district to see a narrative profile comparing it to England and
    Hampshire, with a look at how neighbourhoods (MSOAs) vary within it.
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
  {:else if msoaStore.loading}
    <p class="hint">Loading area data…</p>
  {:else}
    <section class="overview">
      <h2>{selectedName}</h2>
      <p class="lede">
        {selectedName} is home to around <strong>{fmtInt(districtPopulation)}</strong>
        residents across <strong>{msoaCount}</strong> neighbourhoods (MSOAs). That's
        about <strong>{popShare.toFixed(1)}%</strong> of Hampshire's population.
      </p>

      <div class="stat-strip">
        <div class="stat-card">
          <div class="stat-card__label">Total population</div>
          <div class="stat-card__value">{fmtInt(districtPopulation)}</div>
          <div class="stat-card__note">Sum of MSOA estimates (2023)</div>
        </div>
        <div class="stat-card stat-card--green">
          <div class="stat-card__label">Neighbourhoods (MSOAs)</div>
          <div class="stat-card__value">{msoaCount}</div>
          <div class="stat-card__note">Within {selectedName}</div>
        </div>
        <div class="stat-card stat-card--purple">
          <div class="stat-card__label">Share of Hampshire</div>
          <div class="stat-card__value">{popShare.toFixed(1)}%</div>
          <div class="stat-card__note">Of county population</div>
        </div>
      </div>

      <p class="placeholder">
        Health &amp; lifestyle comparisons will appear below in the next build stage.
      </p>
    </section>
  {/if}
</main>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap');

  .report {
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 1rem 4rem;
    font-family: 'Open Sans', system-ui, sans-serif;
    color: #222;
  }
  h1 { color: #206095; font-weight: 700; }
  .intro { font-size: 1.05rem; line-height: 1.5; max-width: 60ch; }

  .picker { display: flex; flex-direction: column; gap: 6px; margin: 1.5rem 0; max-width: 360px; }
  .picker__label { font-weight: 600; font-size: 14px; }
  select {
    font: inherit; font-size: 15px; padding: 9px 10px;
    border: 2px solid #222; border-radius: 0; background: #fff;
  }
  select:focus { outline: 3px solid #fbc900; box-shadow: inset 0 0 0 1px #222; }

  .overview { border-top: 4px solid #206095; padding-top: 1rem; margin-top: 1rem; }
  .overview h2 { color: #222; margin: 0 0 0.5rem; font-size: 24px; }
  .lede { font-size: 1.05rem; line-height: 1.55; max-width: 62ch; }

  .stat-strip { display: flex; gap: 1px; background: #d9d9d9; border: 1px solid #d9d9d9; margin: 1.25rem 0; }
  .stat-card { flex: 1; background: #fff; padding: 14px 18px; border-top: 4px solid #206095; }
  .stat-card--green { border-top-color: #0f8243; }
  .stat-card--purple { border-top-color: #902082; }
  .stat-card__label { font-size: 13px; color: #555; margin-bottom: 4px; }
  .stat-card__value { font-size: 28px; font-weight: 700; color: #222; line-height: 1; }
  .stat-card__note { font-size: 12px; color: #909090; margin-top: 4px; }

  .placeholder, .hint { color: #666; font-style: italic; }

  @media (max-width: 700px) {
    .stat-strip { flex-direction: column; }
  }
</style>