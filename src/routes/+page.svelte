<script>
  // Landing page — the front door, linking out to each tool/section.
</script>

<svelte:head>
  <title>Hampshire JSNA Tools</title>
</svelte:head>

<div class="page">
  <header class="ons-header">
    <div class="ons-header__inner">
      <h1>Hampshire JSNA Tools</h1>
      <p class="ons-header__sub">Explore local health and population statistics across Hampshire</p>
    </div>
  </header>

  <div class="wrap">
    <p class="intro">
      Choose a tool below. These products complement Hampshire's Joint Strategic Needs
      Assessment (JSNA), providing area-specific data, maps, charts and downloads.
    </p>

    <div class="cards">
      <!-- MSOA TOOL -->
      <a href="/explore" class="card">
        <h2>MSOA Data Summary</h2>
        <p>
          A snapshot of population and health indicators at neighbourhood (MSOA) level
          across all Hampshire districts. Includes tables, choropleth maps, ranked
          benchmarking charts and CSV downloads.
        </p>
        <span class="card-link">Open tool →</span>
      </a>

      <!-- DISTRICTS TOOL -->
      <a href="/districts" class="card">
        <h2>District Local Statistics</h2>
        <p>
          A Fingertips / OHID-style view of Hampshire's districts, with trends over time
          and comparisons against regional and national benchmarks, powered by live data feeds.
        </p>
        <span class="card-link">Open tool →</span>
      </a>

      <!-- AREA REPORT TOOL -->
      <a href="/report" class="card">
        <h2>Area Report</h2>
        <p>
          A narrative area profile for a chosen district. Compares the district to
          Hampshire and England, summarises change over time, and shows how
          neighbourhoods (MSOAs) vary within it.
        </p>
        <span class="card-link">Open report →</span>
      </a>
    </div>
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

  .ons-header__inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 28px 24px 32px;
  }

  .ons-header h1 {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: #222;
  }

  .ons-header__sub {
    margin: 8px 0 0;
    color: #555;
    font-size: 17px;
  }

  .wrap {
    max-width: 1100px;
    margin: 0 auto;
    padding: 32px 24px 64px;
  }

  .intro {
    font-size: 16px;
    color: #444;
    max-width: 720px;
    line-height: 1.6;
    margin: 0 0 32px;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 24px;
  }

  .card {
    display: block;
    text-decoration: none;
    color: inherit;
    background: #fff;
    border: 1px solid #d9d9d9;
    border-top: 4px solid #206095;
    padding: 24px;
    transition: box-shadow 0.15s, transform 0.15s;
  }

  .card:hover {
    box-shadow: 0 6px 18px rgba(0,0,0,0.1);
    transform: translateY(-2px);
  }

  .card:focus-visible {
    outline: 3px solid #fbc900;
    outline-offset: 2px;
  }

  .card h2 {
    margin: 10px 0 12px;
    font-size: 22px;
    color: #003c57;
  }

  .card p {
    font-size: 15px;
    color: #444;
    line-height: 1.6;
    margin: 0 0 18px;
  }

  .card-link {
    font-weight: 700;
    color: #206095;
    font-size: 15px;
  }
</style>