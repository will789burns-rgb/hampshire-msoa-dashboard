<script>
  let { rows, fmt } = $props();
</script>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>District</th><th>MSOA</th><th>Code</th>
        <th class="num">Value</th><th class="num">Lower CI</th><th class="num">Upper CI</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as r (r.msoaCode)}
        <tr>
          <td>{r.district}</td><td>{r.msoaName}</td><td>{r.msoaCode}</td>
          <td class="num">{fmt(r.value)}</td><td class="num">{fmt(r.lowerCI)}</td><td class="num">{fmt(r.upperCI)}</td>
        </tr>
      {/each}
      {#if rows.length === 0}
        <tr><td colspan="6" class="empty">No data for this selection.</td></tr>
      {/if}
    </tbody>
  </table>
</div>

<style>
  .table-wrap { overflow-x: auto; border-top: 2px solid #222; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  thead th { text-align: left; padding: 10px 12px; border-bottom: 2px solid #222; font-weight: 700; white-space: nowrap; }
  tbody td { padding: 9px 12px; border-bottom: 1px solid #d9d9d9; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:hover { background: #f5f5f6; }
  .empty { text-align: center; color: #707070; padding: 24px; }
</style>