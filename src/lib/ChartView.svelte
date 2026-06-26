<script>
  let { chartData, stats, districtFilter, fmt } = $props();

  const chartMax = $derived(chartData.length ? Math.max(...chartData.map((d) => d.value)) : 0);
  const chartMin = $derived(chartData.length ? Math.min(0, ...chartData.map((d) => d.value)) : 0);

  const CH = { w: 820, h: 420, left: 8, right: 8, top: 16, bottom: 28 };
  const plotW = $derived(CH.w - CH.left - CH.right);
  const plotH = $derived(CH.h - CH.top - CH.bottom);
  const barW = $derived(chartData.length ? Math.max(1, plotW / chartData.length - 1) : 0);

  function xFor(i) { return CH.left + i * (plotW / Math.max(1, chartData.length)); }
  function yFor(v) {
    const range = chartMax - chartMin || 1;
    return CH.top + plotH - ((v - chartMin) / range) * plotH;
  }
  function barHeight(v) { return CH.top + plotH - yFor(v); }
  const avgY = $derived(yFor(stats.avg));

  let hover = $state(null);
</script>

{#if chartData.length}
  <p class="chart-caption">
    MSOAs ranked by value, highest to lowest.
    {#if districtFilter}<strong>{districtFilter}</strong> highlighted.{/if}
    Dashed line = Hampshire average ({fmt(stats.avg)}).
  </p>
  <div class="chart-wrap">
    <svg viewBox={`0 0 ${CH.w} ${CH.h}`} class="chart" role="img" aria-label="Ranked bar chart of MSOAs">
      <line x1={CH.left} x2={CH.w - CH.right} y1={avgY} y2={avgY} stroke="#d4351c" stroke-width="2" stroke-dasharray="6 4" />
      <text x={CH.w - CH.right} y={avgY - 5} text-anchor="end" font-size="12" fill="#d4351c">Hampshire avg {fmt(stats.avg)}</text>
      {#each chartData as d, i}
        <rect
          x={xFor(i)} y={yFor(d.value)} width={barW} height={barHeight(d.value)}
          fill={d.inFilter ? '#206095' : '#cfd8e0'}
          role="presentation"
          onmouseenter={() => (hover = { ...d, x: xFor(i) + barW / 2, y: yFor(d.value) })}
          onmouseleave={() => (hover = null)}
        />
      {/each}
      <line x1={CH.left} x2={CH.w - CH.right} y1={CH.top + plotH} y2={CH.top + plotH} stroke="#222" stroke-width="1" />
    </svg>
    {#if hover}
      <div class="tip" style={`left:${(hover.x / CH.w) * 100}%; top:${(hover.y / CH.h) * 100}%;`}>
        <strong>{hover.name}</strong><br />{hover.district}<br />{fmt(hover.value)}
      </div>
    {/if}
  </div>
  <p class="rowcount">{chartData.filter((d) => d.inFilter).length} of {chartData.length} MSOAs highlighted</p>
{:else}
  <p class="empty">No data for this selection.</p>
{/if}

<style>
  .chart-caption { font-size: 13px; color: #555; margin: 0 0 12px; }
  .chart-wrap { position: relative; border: 1px solid #d9d9d9; padding: 8px; }
  .chart { width: 100%; height: auto; display: block; }
  .chart rect { cursor: pointer; }
  .chart rect:hover { fill: #003c57 !important; }
  .tip { position: absolute; transform: translate(-50%, -110%); background: #222; color: #fff; font-size: 12px; padding: 6px 8px; border-radius: 3px; pointer-events: none; white-space: nowrap; z-index: 5; }
  .rowcount { font-size: 13px; color: #707070; margin: 10px 0 0; }
  .empty { text-align: center; color: #707070; padding: 24px; }
</style>